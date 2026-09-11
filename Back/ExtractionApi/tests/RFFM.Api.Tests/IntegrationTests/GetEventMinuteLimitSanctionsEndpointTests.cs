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
using RFFM.Api.Features.Coaches.Convocations;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Covers GET /api/events/{eventId}/sanctions/minute-limits (design.md Decisión 9,
    /// tasks.md 5.1): only Pending MinutesLimit sanctions targeting the event, empty array when
    /// none, accessible to every authenticated role.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class GetEventMinuteLimitSanctionsEndpointTests
    {
        private readonly PostgresContainerFixture _fixture;
        private static readonly int MatchEventTypeId = SportEventType.FromName("Partido").Id;

        public GetEventMinuteLimitSanctionsEndpointTests(PostgresContainerFixture fixture)
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

        private async Task<(string TeamId, string TeamPlayerId)> SeedTeamAndPlayerAsync(AppDbContext db)
        {
            var club = Club.Create($"MinuteLimits Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase { Name = "MinuteLimits Test Team", CategoryId = Category.NationalCategory.Id, ClubId = club.Id, SeasonId = season.Id });
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

        private async Task<string> SeedSportEventAsync(AppDbContext db, string teamId, DateTime eveDateTime)
        {
            var sportEvent = SportEvent.CreateNew("MinuteLimits Test Event", eveDateTime, eveDateTime, null, null, null, null, MatchEventTypeId, teamId, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();
            return sportEvent.Id;
        }

        [Fact]
        public async Task ReturnsTwoPendingMinuteLimitSanctionsForTheEvent()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId1) = await SeedTeamAndPlayerAsync(db);
            var (_, teamPlayerId2) = await SeedTeamAndPlayerAsync(db);
            var eventId = await SeedSportEventAsync(db, teamId, DateTime.UtcNow.AddDays(3));

            db.TeamPlayerSanctions.Add(TeamPlayerSanction.Create(
                teamPlayerId1, SanctionCategory.InternalDiscipline, DateTime.UtcNow, "Límite", null, null,
                sportivePunishmentType: SanctionSportivePunishmentType.MinutesLimit, targetEventId: eventId, minutesLimit: 10));
            db.TeamPlayerSanctions.Add(TeamPlayerSanction.Create(
                teamPlayerId2, SanctionCategory.InternalDiscipline, DateTime.UtcNow, "Límite", null, null,
                sportivePunishmentType: SanctionSportivePunishmentType.MinutesLimit, targetEventId: eventId, minutesLimit: 20));
            await db.SaveChangesAsync();

            var (host, client) = await StartHostAsync(new GetEventMinuteLimitSanctions());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/events/{eventId}/sanctions/minute-limits");
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<GetEventMinuteLimitSanctions.MinuteLimitSanctionResponse[]>();
            Assert.NotNull(body);
            Assert.Equal(2, body!.Length);
        }

        [Fact]
        public async Task ExcludesFulfilledMinuteLimitSanctions()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var eventId = await SeedSportEventAsync(db, teamId, DateTime.UtcNow.AddDays(3));

            var sanction = TeamPlayerSanction.Create(
                teamPlayerId, SanctionCategory.InternalDiscipline, DateTime.UtcNow, "Límite", null, null,
                sportivePunishmentType: SanctionSportivePunishmentType.MinutesLimit, targetEventId: eventId, minutesLimit: 10);
            sanction.MarkFulfilled(DateTime.UtcNow);
            db.TeamPlayerSanctions.Add(sanction);
            await db.SaveChangesAsync();

            var (host, client) = await StartHostAsync(new GetEventMinuteLimitSanctions());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/events/{eventId}/sanctions/minute-limits");
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            var body = await response.Content.ReadFromJsonAsync<GetEventMinuteLimitSanctions.MinuteLimitSanctionResponse[]>();
            Assert.Empty(body!);
        }

        [Fact]
        public async Task EventWithNoMinuteLimitSanctions_ReturnsEmptyArray()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _) = await SeedTeamAndPlayerAsync(db);
            var eventId = await SeedSportEventAsync(db, teamId, DateTime.UtcNow.AddDays(3));

            var (host, client) = await StartHostAsync(new GetEventMinuteLimitSanctions());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/events/{eventId}/sanctions/minute-limits");
            request.Headers.Add("X-Test-Role", "Player");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<GetEventMinuteLimitSanctions.MinuteLimitSanctionResponse[]>();
            Assert.Empty(body!);
        }
    }
}
