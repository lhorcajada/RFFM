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
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Players.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Covers the sportive-punishment/payment extension to SetPlayerSanction.cs
    /// (extend-player-sanctions-enforcement-and-payments, tasks.md 3.1/4.4/4.6/4.8): request
    /// validation, forced deconvocation on create/update, delete-blocked-when-fulfilled with the
    /// time-boxed reversible exception. Mirrors SanctionEndpointAuthorizationTests's host bootstrap.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class SanctionSportivePunishmentEndpointTests
    {
        private readonly PostgresContainerFixture _fixture;
        private static readonly int MatchEventTypeId = SportEventType.FromName("Partido").Id;

        public SanctionSportivePunishmentEndpointTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
        {
            public const string SchemeName = "Test";

            public TestAuthHandler(
                IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
                : base(options, logger, encoder)
            {
            }

            protected override Task<AuthenticateResult> HandleAuthenticateAsync()
            {
                var role = Request.Headers.TryGetValue("X-Test-Role", out var values) ? values.ToString() : string.Empty;
                var claims = new List<Claim> { new Claim(ClaimTypes.Name, "test-user") };
                if (!string.IsNullOrEmpty(role)) claims.Add(new Claim(ClaimTypes.Role, role));
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
                            services.AddScoped<RFFM.Api.Domain.Services.ISanctionConvocationEnforcementService, RFFM.Api.Domain.Services.SanctionConvocationEnforcementService>();
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

        private async Task<(string TeamId, string TeamPlayerId)> CreateTeamPlayerAsync()
        {
            await using var db = _fixture.CreateDbContext();

            var club = Club.Create($"Sportive Punishment Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase { Name = "Sportive Punishment Test Team", CategoryId = Category.NationalCategory.Id, ClubId = club.Id, SeasonId = season.Id });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase { Name = "Test", LastName = "Player", Alias = $"testplayer-{Guid.NewGuid():N}", ClubId = club.Id });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id, TeamId = team.Id, SeasonId = season.Id, JoinedDate = DateTime.UtcNow, Dorsal = null, FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            return (team.Id, teamPlayer.Id);
        }

        private async Task<string> CreateSportEventAsync(string teamId, DateTime eveDateTime)
        {
            await using var db = _fixture.CreateDbContext();
            var sportEvent = SportEvent.CreateNew("Sportive Punishment Test Event", eveDateTime, eveDateTime, null, null, null, null, MatchEventTypeId, teamId, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();
            return sportEvent.Id;
        }

        [Fact]
        public async Task CreateDeconvocationSanction_ForcesConvocationAndFulfillsSanction()
        {
            var (teamId, teamPlayerId) = await CreateTeamPlayerAsync();
            var eventId = await CreateSportEventAsync(teamId, DateTime.UtcNow.AddDays(5));
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionCreateRequest(
                    "InternalDiscipline", DateTime.UtcNow, "Desconvocatoria", null, null,
                    SportivePunishmentType: "Deconvocation", TargetEventId: eventId))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<SetPlayerSanction.SanctionRecordResponse>();
            Assert.Equal("Fulfilled", body!.Status);
            Assert.Equal("Deconvocation", body.SportivePunishmentType);

            await using var db = _fixture.CreateDbContext();
            var conv = await db.Convocations.AsNoTracking().SingleAsync(c => c.TeamPlayerId == teamPlayerId && c.SportEventId == eventId);
            Assert.Equal(5, conv.ConvocationStatusId);
            Assert.Equal(ExcuseTypes.SportiveSanction.Id, conv.ExcuseTypeId);
        }

        [Fact]
        public async Task CreateMinutesLimitSanction_DoesNotForceConvocation()
        {
            var (teamId, teamPlayerId) = await CreateTeamPlayerAsync();
            var eventId = await CreateSportEventAsync(teamId, DateTime.UtcNow.AddDays(5));
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionCreateRequest(
                    "InternalDiscipline", DateTime.UtcNow, "Límite de minutos", null, null,
                    SportivePunishmentType: "MinutesLimit", TargetEventId: eventId, MinutesLimit: 10))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<SetPlayerSanction.SanctionRecordResponse>();
            Assert.Equal("Pending", body!.Status);
            Assert.Equal(10, body.MinutesLimit);

            await using var db = _fixture.CreateDbContext();
            var convExists = await db.Convocations.AnyAsync(c => c.TeamPlayerId == teamPlayerId && c.SportEventId == eventId);
            Assert.False(convExists);
        }

        [Fact]
        public async Task CreateSanction_AmountPaidGreaterThanFine_ReturnsBadRequest()
        {
            var (_, teamPlayerId) = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionCreateRequest(
                    "InternalDiscipline", DateTime.UtcNow, "Multa", null, null, Fine: 50m, AmountPaid: 60m))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task CreateSanction_SportivePunishmentTypeWithoutTargetEventId_ReturnsBadRequest()
        {
            var (_, teamPlayerId) = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionCreateRequest(
                    "InternalDiscipline", DateTime.UtcNow, "Límite de minutos", null, null, SportivePunishmentType: "MinutesLimit"))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task CreateSanction_MinutesLimitWithoutMinutesLimitType_ReturnsBadRequest()
        {
            var (teamId, teamPlayerId) = await CreateTeamPlayerAsync();
            var eventId = await CreateSportEventAsync(teamId, DateTime.UtcNow.AddDays(5));
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionCreateRequest(
                    "InternalDiscipline", DateTime.UtcNow, "Desconvocatoria", null, null,
                    SportivePunishmentType: "Deconvocation", TargetEventId: eventId, MinutesLimit: 10))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task CreateSanction_TargetEventIdDoesNotExist_ReturnsNotFound()
        {
            var (_, teamPlayerId) = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionCreateRequest(
                    "InternalDiscipline", DateTime.UtcNow, "Desconvocatoria", null, null,
                    SportivePunishmentType: "Deconvocation", TargetEventId: "does-not-exist"))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task DeletePlayerSanction_FulfilledEconomicSanction_ReturnsConflict()
        {
            var (_, teamPlayerId) = await CreateTeamPlayerAsync();
            await using (var db = _fixture.CreateDbContext())
            {
                var sanction = TeamPlayerSanction.Create(teamPlayerId, SanctionCategory.InternalDiscipline, DateTime.UtcNow, "Multa", null, null, fine: 20m);
                sanction.MarkFulfilled(DateTime.UtcNow);
                db.TeamPlayerSanctions.Add(sanction);
                await db.SaveChangesAsync();

                var (host, client) = await StartHostAsync(new SetPlayerSanction());
                using var _ = host;

                var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions/{sanction.Id}");
                request.Headers.Add("X-Test-Role", "Coach");

                var response = await client.SendAsync(request);

                Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            }
        }

        [Fact]
        public async Task DeletePlayerSanction_FulfilledDeconvocationTargetingFutureEvent_DeletesAndRevertsConvocation()
        {
            var (teamId, teamPlayerId) = await CreateTeamPlayerAsync();
            var eventId = await CreateSportEventAsync(teamId, DateTime.UtcNow.AddDays(5));
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            // Create via the endpoint so the convocation is force-created for real.
            var createRequest = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionCreateRequest(
                    "InternalDiscipline", DateTime.UtcNow, "Desconvocatoria", null, null,
                    SportivePunishmentType: "Deconvocation", TargetEventId: eventId))
            };
            createRequest.Headers.Add("X-Test-Role", "Coach");
            var createResponse = await client.SendAsync(createRequest);
            var created = await createResponse.Content.ReadFromJsonAsync<SetPlayerSanction.SanctionRecordResponse>();

            var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions/{created!.Id}");
            deleteRequest.Headers.Add("X-Test-Role", "Coach");
            var deleteResponse = await client.SendAsync(deleteRequest);

            Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

            await using var db = _fixture.CreateDbContext();
            var conv = await db.Convocations.AsNoTracking().SingleAsync(c => c.TeamPlayerId == teamPlayerId && c.SportEventId == eventId);
            Assert.Equal(1, conv.ConvocationStatusId);
            Assert.Null(conv.ExcuseTypeId);
            var sanctionExists = await db.TeamPlayerSanctions.AnyAsync(s => s.Id == created.Id);
            Assert.False(sanctionExists);
        }

        [Fact]
        public async Task DeletePlayerSanction_FulfilledDeconvocationTargetingPastEvent_ReturnsConflict()
        {
            var (teamId, teamPlayerId) = await CreateTeamPlayerAsync();
            var eventId = await CreateSportEventAsync(teamId, DateTime.UtcNow.AddDays(-5));

            string sanctionId;
            await using (var db = _fixture.CreateDbContext())
            {
                var sanction = TeamPlayerSanction.Create(
                    teamPlayerId, SanctionCategory.InternalDiscipline, DateTime.UtcNow.AddDays(-6), "Desconvocatoria", null, null,
                    sportivePunishmentType: SanctionSportivePunishmentType.Deconvocation, targetEventId: eventId);
                sanction.MarkFulfilled(DateTime.UtcNow);
                db.TeamPlayerSanctions.Add(sanction);
                await db.SaveChangesAsync();
                sanctionId = sanction.Id;
            }

            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions/{sanctionId}");
            deleteRequest.Headers.Add("X-Test-Role", "Coach");
            var deleteResponse = await client.SendAsync(deleteRequest);

            Assert.Equal(HttpStatusCode.Conflict, deleteResponse.StatusCode);
        }

        [Fact]
        public async Task UpdateSanction_MovesDeconvocationToDifferentFutureEvent_RevertsOldAndForcesNew()
        {
            var (teamId, teamPlayerId) = await CreateTeamPlayerAsync();
            var eventA = await CreateSportEventAsync(teamId, DateTime.UtcNow.AddDays(5));
            var eventB = await CreateSportEventAsync(teamId, DateTime.UtcNow.AddDays(10));
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var createRequest = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionCreateRequest(
                    "InternalDiscipline", DateTime.UtcNow, "Desconvocatoria", null, null,
                    SportivePunishmentType: "Deconvocation", TargetEventId: eventA))
            };
            createRequest.Headers.Add("X-Test-Role", "Coach");
            var createResponse = await client.SendAsync(createRequest);
            var created = await createResponse.Content.ReadFromJsonAsync<SetPlayerSanction.SanctionRecordResponse>();

            var updateRequest = new HttpRequestMessage(HttpMethod.Put, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions/{created!.Id}")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionUpdateRequest(
                    "InternalDiscipline", DateTime.UtcNow, "Desconvocatoria", null, null, null,
                    SportivePunishmentType: "Deconvocation", TargetEventId: eventB))
            };
            updateRequest.Headers.Add("X-Test-Role", "Coach");
            var updateResponse = await client.SendAsync(updateRequest);

            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

            await using var db = _fixture.CreateDbContext();
            var convA = await db.Convocations.AsNoTracking().SingleAsync(c => c.TeamPlayerId == teamPlayerId && c.SportEventId == eventA);
            Assert.Equal(1, convA.ConvocationStatusId);
            var convB = await db.Convocations.AsNoTracking().SingleAsync(c => c.TeamPlayerId == teamPlayerId && c.SportEventId == eventB);
            Assert.Equal(5, convB.ConvocationStatusId);
        }

        [Fact]
        public async Task UpdateSanction_MovingDeconvocationAwayFromPastEvent_ReturnsConflict()
        {
            var (teamId, teamPlayerId) = await CreateTeamPlayerAsync();
            var pastEventId = await CreateSportEventAsync(teamId, DateTime.UtcNow.AddDays(-5));
            var newEventId = await CreateSportEventAsync(teamId, DateTime.UtcNow.AddDays(10));

            string sanctionId;
            await using (var db = _fixture.CreateDbContext())
            {
                var sanction = TeamPlayerSanction.Create(
                    teamPlayerId, SanctionCategory.InternalDiscipline, DateTime.UtcNow.AddDays(-6), "Desconvocatoria", null, null,
                    sportivePunishmentType: SanctionSportivePunishmentType.Deconvocation, targetEventId: pastEventId);
                sanction.MarkFulfilled(DateTime.UtcNow);
                db.TeamPlayerSanctions.Add(sanction);
                await db.SaveChangesAsync();
                sanctionId = sanction.Id;
            }

            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var updateRequest = new HttpRequestMessage(HttpMethod.Put, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions/{sanctionId}")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionUpdateRequest(
                    "InternalDiscipline", DateTime.UtcNow, "Desconvocatoria", null, null, null,
                    SportivePunishmentType: "Deconvocation", TargetEventId: newEventId))
            };
            updateRequest.Headers.Add("X-Test-Role", "Coach");
            var updateResponse = await client.SendAsync(updateRequest);

            Assert.Equal(HttpStatusCode.Conflict, updateResponse.StatusCode);
        }

        [Fact]
        public async Task UpdateSanction_UnrelatedFieldsOnPastFulfilledDeconvocation_Succeeds()
        {
            var (teamId, teamPlayerId) = await CreateTeamPlayerAsync();
            var pastEventId = await CreateSportEventAsync(teamId, DateTime.UtcNow.AddDays(-5));

            string sanctionId;
            DateTime endDate;
            await using (var db = _fixture.CreateDbContext())
            {
                var sanction = TeamPlayerSanction.Create(
                    teamPlayerId, SanctionCategory.InternalDiscipline, DateTime.UtcNow.AddDays(-6), "Desconvocatoria", null, null,
                    sportivePunishmentType: SanctionSportivePunishmentType.Deconvocation, targetEventId: pastEventId);
                sanction.MarkFulfilled(DateTime.UtcNow);
                db.TeamPlayerSanctions.Add(sanction);
                await db.SaveChangesAsync();
                sanctionId = sanction.Id;
                endDate = sanction.EndDate!.Value;
            }

            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            // PUT is a full replace (same contract as today's endpoint): the request must repeat
            // the sanction's current EndDate to keep it Fulfilled, exactly as it must repeat any
            // other field it wants to preserve.
            var updateRequest = new HttpRequestMessage(HttpMethod.Put, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions/{sanctionId}")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionUpdateRequest(
                    "InternalDiscipline", DateTime.UtcNow.AddDays(-6), "Desconvocatoria", "Nota actualizada", null, endDate,
                    Fine: 15m, SportivePunishmentType: "Deconvocation", TargetEventId: pastEventId))
            };
            updateRequest.Headers.Add("X-Test-Role", "Coach");
            var updateResponse = await client.SendAsync(updateRequest);

            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
            var body = await updateResponse.Content.ReadFromJsonAsync<SetPlayerSanction.SanctionRecordResponse>();
            Assert.Equal(15m, body!.Fine);
            Assert.Equal("Fulfilled", body.Status);
        }
    }
}
