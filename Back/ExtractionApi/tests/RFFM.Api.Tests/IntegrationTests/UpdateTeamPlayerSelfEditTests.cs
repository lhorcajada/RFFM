#nullable enable
using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Players.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Backend tests for the openspec change "player-self-edit-physical-family-contact" (§1):
    /// PUT /api/catalog/teamplayer/{id} must let Player/FamilyMember callers edit their OWN
    /// linked TeamPlayer's Contact/Physical/Family/photo, while silently ignoring
    /// Dorsal/Demarcation/Name/LastName/Alias for those roles, and must return 403 with
    /// code = TeamPlayerEditForbidden when the caller is not linked to the target TeamPlayer.
    /// Coach/Administrator must keep editing every field (regression).
    ///
    /// This endpoint is an inline Minimal API delegate (see UpdateTeamPlayer.cs header comment),
    /// so it cannot use IRequireFeaturePermission; ownership is checked directly against
    /// UserTeam.LinkedTeamPlayerId, mirroring ConfirmAttendance.cs.
    ///
    /// Runs against a real Postgres instance (Testcontainers), same as
    /// RatingEndpointAuthorizationTests / InjuryEndpointAuthorizationTests.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class UpdateTeamPlayerSelfEditTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UpdateTeamPlayerSelfEditTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        /// <summary>
        /// Authentication handler for tests: authenticates using the "X-Test-Role" header as a
        /// ClaimTypes.Role claim and "X-Test-UserId" header as the nameidentifier claim consumed
        /// by CurrentUserService.UserId.
        /// </summary>
        private class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
        {
            public const string SchemeName = "Test";

            public TestAuthHandler(
                IOptionsMonitor<AuthenticationSchemeOptions> options,
                ILoggerFactory logger,
                UrlEncoder encoder)
                : base(options, logger, encoder)
            {
            }

            protected override Task<AuthenticateResult> HandleAuthenticateAsync()
            {
                var role = Request.Headers.TryGetValue("X-Test-Role", out var roleValues)
                    ? roleValues.ToString()
                    : string.Empty;
                var userId = Request.Headers.TryGetValue("X-Test-UserId", out var userIdValues)
                    ? userIdValues.ToString()
                    : string.Empty;

                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.Name, "test-user"),
                };
                if (!string.IsNullOrEmpty(role))
                {
                    claims.Add(new Claim(ClaimTypes.Role, role));
                }
                if (!string.IsNullOrEmpty(userId))
                {
                    claims.Add(new Claim(ClaimTypes.NameIdentifier, userId));
                }

                var identity = new ClaimsIdentity(claims, SchemeName);
                var principal = new ClaimsPrincipal(identity);
                var ticket = new AuthenticationTicket(principal, SchemeName);
                return Task.FromResult(AuthenticateResult.Success(ticket));
            }
        }

        private async Task<(IHost Host, HttpClient Client)> StartHostAsync(IFeatureModule module)
        {
            var host = new HostBuilder()
                .ConfigureWebHost(webBuilder =>
                {
                    webBuilder
                        .UseTestServer()
                        .ConfigureServices(services =>
                        {
                            services.AddRouting();
                            services.AddHttpContextAccessor();
                            services.AddScoped<ICurrentUserService, CurrentUserService>();
                            services.AddAuthentication(TestAuthHandler.SchemeName)
                                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
                            services.AddAuthorization();
                            services.AddDbContext<AppDbContext>(options =>
                            {
                                options.UseNpgsql(_fixture.ConnectionString, npgsql =>
                                {
                                    npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "app");
                                });
                            });
                        })
                        .Configure(app =>
                        {
                            app.UseRouting();
                            app.UseAuthentication();
                            app.UseAuthorization();
                            app.UseEndpoints(endpoints => module.AddRoutes(endpoints));
                        });
                })
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient());
        }

        private async Task<string> CreateTeamPlayerAsync(bool withExistingFamilyMember = false)
        {
            await using var setupDb = _fixture.CreateDbContext();

            var club = Club.Create($"SelfEdit Auth Test Club {Guid.NewGuid():N}", 1);
            setupDb.Clubs.Add(club);
            await setupDb.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}",
                DateTime.UtcNow,
                DateTime.UtcNow.AddMonths(9),
                isActive: true,
                club: club);
            setupDb.Seasons.Add(season);
            await setupDb.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "SelfEdit Auth Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            setupDb.Teams.Add(team);
            await setupDb.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test",
                LastName = "Player",
                Alias = $"testplayer-{Guid.NewGuid():N}",
                ClubId = club.Id
            });
            setupDb.Players.Add(player);
            await setupDb.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = team.Id,
                SeasonId = season.Id,
                JoinedDate = DateTime.UtcNow,
                Dorsal = null,
                FamilyMembers = withExistingFamilyMember
                    ? new List<FamilyModel> { new FamilyModel { Name = "Original Mom", Phone = "600000001", Email = "original-mom@example.com", FamilyMemberId = 1 } }
                    : new List<FamilyModel>()
            });
            setupDb.TeamPlayers.Add(teamPlayer);
            await setupDb.SaveChangesAsync();

            return teamPlayer.Id;
        }

        private async Task LinkUserToTeamPlayerAsync(string applicationUserId, string teamPlayerId, string teamId, int membershipId)
        {
            await using var setupDb = _fixture.CreateDbContext();

            var userTeam = new UserTeam(applicationUserId, teamId, membershipId);
            userTeam.LinkPlayer(teamPlayerId);
            setupDb.Set<UserTeam>().Add(userTeam);
            await setupDb.SaveChangesAsync();
        }

        private async Task<string> GetTeamIdForTeamPlayerAsync(string teamPlayerId)
        {
            await using var db = _fixture.CreateDbContext();
            var teamPlayer = await db.TeamPlayers.AsNoTracking().SingleAsync(tp => tp.Id == teamPlayerId);
            return teamPlayer.TeamId;
        }

        private static HttpRequestMessage BuildUpdateRequest(string teamPlayerId, UpdateTeamPlayer.UpdateRequest body, string role, string? userId = null)
        {
            var request = new HttpRequestMessage(HttpMethod.Put, $"/api/catalog/teamplayer/{teamPlayerId}")
            {
                Content = JsonContent.Create(body)
            };
            request.Headers.Add("X-Test-Role", role);
            if (userId != null)
            {
                request.Headers.Add("X-Test-UserId", userId);
            }
            return request;
        }

        [Fact]
        public async Task Coach_CanStillUpdateAllFields()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new UpdateTeamPlayer());
            using var _ = host;

            var body = new UpdateTeamPlayer.UpdateRequest(
                Dorsal: 9,
                PlayerInfo: new UpdateTeamPlayer.PlayerInfoRequest("Updated Name", "Updated LastName", "UpdatedAlias", null,
                    "Asma", "Frutos secos", "ADC Brunete"),
                Demarcation: new UpdateTeamPlayer.DemarcationRequest(1, new[] { 1, 2 }),
                ContactInfo: new UpdateTeamPlayer.ContactRequest("600000000", "coach-edit@example.com"),
                PhysicalInfo: new UpdateTeamPlayer.PhysicalRequest(180.5m, 75.2m, 1),
                FamilyMembers: new[] { new UpdateTeamPlayer.FamilyRequest("Mom", "622222222", "mom@example.com", 1, "52378762B", "Smith") });

            var response = await client.SendAsync(BuildUpdateRequest(teamPlayerId, body, "Coach"));

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var resp = await response.Content.ReadFromJsonAsync<UpdateTeamPlayer.TeamPlayerResponse>();
            Assert.NotNull(resp);
            Assert.Equal(9, resp!.Dorsal);
            Assert.Equal("Updated Name", resp.Player.Name);
            Assert.Equal("Updated LastName", resp.Player.LastName);
            Assert.Equal(1, resp.Demarcation?.ActivePositionId);
            Assert.Equal("600000000", resp.ContactInfo?.Phone);
            Assert.Equal("coach-edit@example.com", resp.ContactInfo?.Email);
            Assert.Equal(180.5m, resp.PhysicalInfo?.Height);
            Assert.Equal("Asma", resp.Player.Enfermedades);
            Assert.Equal("Frutos secos", resp.Player.Alergias);
            Assert.Equal("ADC Brunete", resp.Player.Procedencia);
            Assert.Equal("52378762B", resp.FamilyMembers.Single().Dni);
            Assert.False(string.IsNullOrWhiteSpace(resp.FamilyMembers.Single().Id));
            Assert.Equal("Smith", resp.FamilyMembers.Single().LastName);
        }

        [Fact]
        public async Task LinkedPlayer_CanUpdateContactPhysicalFamilyAndPhoto_ButNotDorsalDemarcationOrName()
        {
            var teamPlayerId = await CreateTeamPlayerAsync(withExistingFamilyMember: true);
            var teamId = await GetTeamIdForTeamPlayerAsync(teamPlayerId);
            var applicationUserId = $"user-{Guid.NewGuid():N}";
            await LinkUserToTeamPlayerAsync(applicationUserId, teamPlayerId, teamId, Membership.Player.Id);

            var (host, client) = await StartHostAsync(new UpdateTeamPlayer());
            using var _ = host;

            var body = new UpdateTeamPlayer.UpdateRequest(
                Dorsal: 9,
                PlayerInfo: new UpdateTeamPlayer.PlayerInfoRequest("Should Not Apply", "Should Not Apply", "ShouldNotApply", "https://example.com/photo.png",
                    "Asma", "Frutos secos", "ADC Brunete"),
                Demarcation: new UpdateTeamPlayer.DemarcationRequest(1, new[] { 1, 2 }),
                ContactInfo: new UpdateTeamPlayer.ContactRequest("611111111", "player-edit@example.com"),
                PhysicalInfo: new UpdateTeamPlayer.PhysicalRequest(175m, 70m, 2),
                FamilyMembers: new[] { new UpdateTeamPlayer.FamilyRequest("Mom", "622222222", "mom@example.com", 1, "52378762B", "Smith") });

            var response = await client.SendAsync(BuildUpdateRequest(teamPlayerId, body, "Player", applicationUserId));

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var resp = await response.Content.ReadFromJsonAsync<UpdateTeamPlayer.TeamPlayerResponse>();
            Assert.NotNull(resp);

            // Allowed fields applied
            Assert.Equal("https://example.com/photo.png", resp!.Player.UrlPhoto);
            Assert.Equal("611111111", resp.ContactInfo?.Phone);
            Assert.Equal("player-edit@example.com", resp.ContactInfo?.Email);
            Assert.Equal(175m, resp.PhysicalInfo?.Height);
            Assert.Equal(70m, resp.PhysicalInfo?.Weight);
            Assert.Single(resp.FamilyMembers);
            Assert.Equal("Mom", resp.FamilyMembers[0].Name);
            Assert.Equal("52378762B", resp.FamilyMembers[0].Dni);
            Assert.False(string.IsNullOrWhiteSpace(resp.FamilyMembers[0].Id));
            Assert.Equal("Smith", resp.FamilyMembers[0].LastName);
            Assert.Equal("Asma", resp.Player.Enfermedades);
            Assert.Equal("Frutos secos", resp.Player.Alergias);
            Assert.Equal("ADC Brunete", resp.Player.Procedencia);

            // Disallowed fields ignored
            Assert.Null(resp.Dorsal);
            Assert.Null(resp.Demarcation?.ActivePositionId);
            Assert.NotEqual("Should Not Apply", resp.Player.Name);
            Assert.NotEqual("Should Not Apply", resp.Player.LastName);
            Assert.NotEqual("ShouldNotApply", resp.Player.Alias);
        }

        [Fact]
        public async Task LinkedFamilyMember_CanUpdateContactPhysicalFamilyAndPhoto_ButNotDorsalDemarcationOrName()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var teamId = await GetTeamIdForTeamPlayerAsync(teamPlayerId);
            var applicationUserId = $"user-{Guid.NewGuid():N}";
            await LinkUserToTeamPlayerAsync(applicationUserId, teamPlayerId, teamId, Membership.FamilyPlayer.Id);

            var (host, client) = await StartHostAsync(new UpdateTeamPlayer());
            using var _ = host;

            var body = new UpdateTeamPlayer.UpdateRequest(
                Dorsal: 7,
                PlayerInfo: new UpdateTeamPlayer.PlayerInfoRequest("Should Not Apply", null, null, "https://example.com/family-photo.png"),
                Demarcation: new UpdateTeamPlayer.DemarcationRequest(2, new[] { 2 }),
                ContactInfo: new UpdateTeamPlayer.ContactRequest("633333333", "family-edit@example.com"),
                PhysicalInfo: new UpdateTeamPlayer.PhysicalRequest(160m, 55m, 3),
                FamilyMembers: null);

            var response = await client.SendAsync(BuildUpdateRequest(teamPlayerId, body, "FamilyMember", applicationUserId));

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var resp = await response.Content.ReadFromJsonAsync<UpdateTeamPlayer.TeamPlayerResponse>();
            Assert.NotNull(resp);

            Assert.Equal("https://example.com/family-photo.png", resp!.Player.UrlPhoto);
            Assert.Equal("633333333", resp.ContactInfo?.Phone);
            Assert.Equal(160m, resp.PhysicalInfo?.Height);

            Assert.Null(resp.Dorsal);
            Assert.Null(resp.Demarcation?.ActivePositionId);
            Assert.NotEqual("Should Not Apply", resp.Player.Name);
        }

        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task NotLinkedPlayer_ReturnsForbiddenWithTeamPlayerEditForbiddenCode_AndDoesNotPersistChanges(string role)
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var applicationUserId = $"user-{Guid.NewGuid():N}"; // never linked to this TeamPlayer

            var (host, client) = await StartHostAsync(new UpdateTeamPlayer());
            using var _ = host;

            var body = new UpdateTeamPlayer.UpdateRequest(
                Dorsal: null,
                PlayerInfo: null,
                Demarcation: null,
                ContactInfo: new UpdateTeamPlayer.ContactRequest("644444444", "notlinked@example.com"),
                PhysicalInfo: null,
                FamilyMembers: null);

            var response = await client.SendAsync(BuildUpdateRequest(teamPlayerId, body, role, applicationUserId));

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            var problem = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
            Assert.Equal(ErrorCodes.TeamPlayerEditForbidden, problem.GetProperty("code").GetString());

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.TeamPlayers
                .Include(tp => tp.ContactInfo)
                .AsNoTracking()
                .SingleAsync(tp => tp.Id == teamPlayerId);
            Assert.Null(stored.ContactInfo?.Phone);
        }

        [Fact]
        public async Task LinkedPlayer_ButLinkedToDifferentTeamPlayer_ReturnsForbidden()
        {
            var ownTeamPlayerId = await CreateTeamPlayerAsync();
            var otherTeamPlayerId = await CreateTeamPlayerAsync();
            var teamId = await GetTeamIdForTeamPlayerAsync(ownTeamPlayerId);
            var applicationUserId = $"user-{Guid.NewGuid():N}";
            await LinkUserToTeamPlayerAsync(applicationUserId, ownTeamPlayerId, teamId, Membership.Player.Id);

            var (host, client) = await StartHostAsync(new UpdateTeamPlayer());
            using var _ = host;

            var body = new UpdateTeamPlayer.UpdateRequest(null, null, null,
                new UpdateTeamPlayer.ContactRequest("655555555", "other@example.com"), null, null);

            var response = await client.SendAsync(BuildUpdateRequest(otherTeamPlayerId, body, "Player", applicationUserId));

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task Coach_CanUpdateContactAddress_PersistsAllFields()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new UpdateTeamPlayer());
            using var _ = host;

            var body = new UpdateTeamPlayer.UpdateRequest(
                Dorsal: null,
                PlayerInfo: null,
                Demarcation: null,
                ContactInfo: new UpdateTeamPlayer.ContactRequest(
                    "600000000",
                    "coach-edit@example.com",
                    new UpdateTeamPlayer.AddressRequest("Calle Falsa 123", "Madrid", "Madrid", "28080", "España")),
                PhysicalInfo: null,
                FamilyMembers: null);

            var response = await client.SendAsync(BuildUpdateRequest(teamPlayerId, body, "Coach"));

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var resp = await response.Content.ReadFromJsonAsync<UpdateTeamPlayer.TeamPlayerResponse>();
            Assert.NotNull(resp);
            Assert.Equal("Calle Falsa 123", resp!.ContactInfo?.Address?.Street);
            Assert.Equal("Madrid", resp.ContactInfo?.Address?.City);
            Assert.Equal("Madrid", resp.ContactInfo?.Address?.Province);
            Assert.Equal("28080", resp.ContactInfo?.Address?.PostalCode);
            Assert.Equal("España", resp.ContactInfo?.Address?.Country);
        }

        [Fact]
        public async Task Coach_UpdatingContactWithoutAddress_DoesNotEraseExistingAddress()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new UpdateTeamPlayer());
            using var _ = host;

            var withAddress = new UpdateTeamPlayer.UpdateRequest(
                Dorsal: null,
                PlayerInfo: null,
                Demarcation: null,
                ContactInfo: new UpdateTeamPlayer.ContactRequest(
                    "600000000",
                    "coach-edit@example.com",
                    new UpdateTeamPlayer.AddressRequest("Calle Falsa 123", "Madrid", "Madrid", "28080", "España")),
                PhysicalInfo: null,
                FamilyMembers: null);
            await client.SendAsync(BuildUpdateRequest(teamPlayerId, withAddress, "Coach"));

            var withoutAddress = new UpdateTeamPlayer.UpdateRequest(
                Dorsal: null,
                PlayerInfo: null,
                Demarcation: null,
                ContactInfo: new UpdateTeamPlayer.ContactRequest("611111111", "coach-edit-2@example.com"),
                PhysicalInfo: null,
                FamilyMembers: null);
            var response = await client.SendAsync(BuildUpdateRequest(teamPlayerId, withoutAddress, "Coach"));

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var resp = await response.Content.ReadFromJsonAsync<UpdateTeamPlayer.TeamPlayerResponse>();
            Assert.NotNull(resp);
            Assert.Equal("611111111", resp!.ContactInfo?.Phone);
            Assert.Equal("Calle Falsa 123", resp.ContactInfo?.Address?.Street);
            Assert.Equal("Madrid", resp.ContactInfo?.Address?.City);
            Assert.Equal("28080", resp.ContactInfo?.Address?.PostalCode);
        }
    }
}
