#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
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
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Domain.Models;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Players.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Covers the team-fund side effect wired into SetPlayerSanction.cs's POST/PUT/DELETE handlers
    /// (add-team-fund-and-sanction-player-photo, design.md Decisión 2): creating/editing/deleting a
    /// sanction's AmountPaid must create/update/zero-out exactly one linked TeamFundMovement row,
    /// keeping the team's fund balance (SUM(Amount) over its movements) correct. Mirrors
    /// GetTeamSanctionsEndpointTests's host bootstrap.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class SetPlayerSanctionTeamFundTests
    {
        private readonly PostgresContainerFixture _fixture;

        public SetPlayerSanctionTeamFundTests(PostgresContainerFixture fixture)
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

        private async Task<(string TeamId, string TeamPlayerId)> CreateTeamPlayerAsync(string? teamId = null)
        {
            await using var setupDb = _fixture.CreateDbContext();

            var club = Club.Create($"Team Fund Test Club {Guid.NewGuid():N}", 1);
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

            Team team;
            if (teamId != null)
            {
                team = await setupDb.Teams.FirstAsync(t => t.Id == teamId);
            }
            else
            {
                team = new Team(new TeamModelBase
                {
                    Name = "Team Fund Test Team",
                    CategoryId = Category.NationalCategory.Id,
                    ClubId = club.Id,
                    SeasonId = season.Id
                });
                setupDb.Teams.Add(team);
                await setupDb.SaveChangesAsync();
            }

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
                FamilyMembers = new List<FamilyModel>()
            });
            setupDb.TeamPlayers.Add(teamPlayer);
            await setupDb.SaveChangesAsync();

            return (team.Id, teamPlayer.Id);
        }

        private static SetPlayerSanction.SanctionCreateRequest NewCreateRequest(decimal? fine = 100m, decimal? amountPaid = null) =>
            new("Competition", DateTime.UtcNow, "Expulsión", "Test sanction", "2 partidos", fine, amountPaid);

        private static SetPlayerSanction.SanctionUpdateRequest NewUpdateRequest(decimal? fine = 100m, decimal? amountPaid = null) =>
            new("Competition", DateTime.UtcNow, "Expulsión", "Test sanction", "2 partidos", null, fine, amountPaid);

        private async Task<decimal> GetTeamFundBalanceAsync(string teamId)
        {
            await using var db = _fixture.CreateDbContext();
            return await db.TeamFundMovements
                .Where(m => m.TeamId == teamId)
                .SumAsync(m => (decimal?)m.Amount) ?? 0m;
        }

        private async Task<TeamFundMovement?> GetMovementForSanctionAsync(string sanctionId)
        {
            await using var db = _fixture.CreateDbContext();
            return await db.TeamFundMovements.FirstOrDefaultAsync(m => m.SourceSanctionId == sanctionId);
        }

        [Fact]
        public async Task Create_WithAmountPaid_CreatesMovementAndUpdatesBalance()
        {
            var (teamId, teamPlayerId) = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions")
            {
                Content = JsonContent.Create(NewCreateRequest(fine: 100m, amountPaid: 40m))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var created = await response.Content.ReadFromJsonAsync<SetPlayerSanction.SanctionRecordResponse>();
            Assert.NotNull(created);

            var movement = await GetMovementForSanctionAsync(created!.Id);
            Assert.NotNull(movement);
            Assert.Equal(40m, movement!.Amount);
            Assert.Equal(TeamFundMovementSource.SanctionPayment, movement.Source);

            var balance = await GetTeamFundBalanceAsync(teamId);
            Assert.Equal(40m, balance);
        }

        [Fact]
        public async Task Create_WithoutAmountPaid_CreatesNoMovementAndBalanceUnaffected()
        {
            var (teamId, teamPlayerId) = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions")
            {
                Content = JsonContent.Create(NewCreateRequest(fine: 100m, amountPaid: null))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var created = await response.Content.ReadFromJsonAsync<SetPlayerSanction.SanctionRecordResponse>();

            var movement = await GetMovementForSanctionAsync(created!.Id);
            Assert.Null(movement);

            var balance = await GetTeamFundBalanceAsync(teamId);
            Assert.Equal(0m, balance);
        }

        [Fact]
        public async Task Update_IncreasingAmountPaid_UpdatesSameMovementRow()
        {
            var (teamId, teamPlayerId) = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var createRequest = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions")
            {
                Content = JsonContent.Create(NewCreateRequest(fine: 100m, amountPaid: 40m))
            };
            createRequest.Headers.Add("X-Test-Role", "Coach");
            var createResponse = await client.SendAsync(createRequest);
            var created = await createResponse.Content.ReadFromJsonAsync<SetPlayerSanction.SanctionRecordResponse>();

            var movementBefore = await GetMovementForSanctionAsync(created!.Id);
            Assert.NotNull(movementBefore);
            var movementId = movementBefore!.Id;

            var updateRequest = new HttpRequestMessage(HttpMethod.Put, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions/{created.Id}")
            {
                Content = JsonContent.Create(NewUpdateRequest(fine: 100m, amountPaid: 70m))
            };
            updateRequest.Headers.Add("X-Test-Role", "Coach");
            var updateResponse = await client.SendAsync(updateRequest);
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

            var movementAfter = await GetMovementForSanctionAsync(created.Id);
            Assert.NotNull(movementAfter);
            Assert.Equal(movementId, movementAfter!.Id);
            Assert.Equal(70m, movementAfter.Amount);

            var balance = await GetTeamFundBalanceAsync(teamId);
            Assert.Equal(70m, balance);
        }

        [Fact]
        public async Task Update_DecreasingAmountPaid_ReducesBalanceByTheDifference()
        {
            var (teamId, teamPlayerId) = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var createRequest = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions")
            {
                Content = JsonContent.Create(NewCreateRequest(fine: 100m, amountPaid: 70m))
            };
            createRequest.Headers.Add("X-Test-Role", "Coach");
            var createResponse = await client.SendAsync(createRequest);
            var created = await createResponse.Content.ReadFromJsonAsync<SetPlayerSanction.SanctionRecordResponse>();

            var updateRequest = new HttpRequestMessage(HttpMethod.Put, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions/{created!.Id}")
            {
                Content = JsonContent.Create(NewUpdateRequest(fine: 100m, amountPaid: 30m))
            };
            updateRequest.Headers.Add("X-Test-Role", "Coach");
            var updateResponse = await client.SendAsync(updateRequest);
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

            var balance = await GetTeamFundBalanceAsync(teamId);
            Assert.Equal(30m, balance);
        }

        [Fact]
        public async Task Update_AmountPaidToNull_ZeroesLinkedMovementButKeepsRow()
        {
            var (teamId, teamPlayerId) = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var createRequest = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions")
            {
                Content = JsonContent.Create(NewCreateRequest(fine: 100m, amountPaid: 40m))
            };
            createRequest.Headers.Add("X-Test-Role", "Coach");
            var createResponse = await client.SendAsync(createRequest);
            var created = await createResponse.Content.ReadFromJsonAsync<SetPlayerSanction.SanctionRecordResponse>();

            var updateRequest = new HttpRequestMessage(HttpMethod.Put, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions/{created!.Id}")
            {
                Content = JsonContent.Create(NewUpdateRequest(fine: 100m, amountPaid: null))
            };
            updateRequest.Headers.Add("X-Test-Role", "Coach");
            var updateResponse = await client.SendAsync(updateRequest);
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

            var movement = await GetMovementForSanctionAsync(created.Id);
            Assert.NotNull(movement);
            Assert.Equal(0m, movement!.Amount);

            var balance = await GetTeamFundBalanceAsync(teamId);
            Assert.Equal(0m, balance);
        }

        [Fact]
        public async Task TwoIndependentSanctions_SameTeam_SumCorrectlyIntoSharedBalance()
        {
            var (teamId, teamPlayerId1) = await CreateTeamPlayerAsync();
            var (_, teamPlayerId2) = await CreateTeamPlayerAsync(teamId);
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request1 = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId1}/sanctions")
            {
                Content = JsonContent.Create(NewCreateRequest(fine: 100m, amountPaid: 40m))
            };
            request1.Headers.Add("X-Test-Role", "Coach");
            await client.SendAsync(request1);

            var request2 = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId2}/sanctions")
            {
                Content = JsonContent.Create(NewCreateRequest(fine: 50m, amountPaid: 25m))
            };
            request2.Headers.Add("X-Test-Role", "Coach");
            await client.SendAsync(request2);

            var balance = await GetTeamFundBalanceAsync(teamId);
            Assert.Equal(65m, balance);
        }

        [Fact]
        public async Task Delete_PendingSanctionWithAmountPaid_ZeroesMovementAndKeepsRow()
        {
            var (teamId, teamPlayerId) = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var createRequest = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions")
            {
                Content = JsonContent.Create(NewCreateRequest(fine: 100m, amountPaid: 40m))
            };
            createRequest.Headers.Add("X-Test-Role", "Coach");
            var createResponse = await client.SendAsync(createRequest);
            var created = await createResponse.Content.ReadFromJsonAsync<SetPlayerSanction.SanctionRecordResponse>();

            var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions/{created!.Id}");
            deleteRequest.Headers.Add("X-Test-Role", "Coach");
            var deleteResponse = await client.SendAsync(deleteRequest);
            Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

            var movement = await GetMovementForSanctionAsync(created.Id);
            Assert.NotNull(movement);
            Assert.Equal(0m, movement!.Amount);

            var balance = await GetTeamFundBalanceAsync(teamId);
            Assert.Equal(0m, balance);
        }
    }
}
