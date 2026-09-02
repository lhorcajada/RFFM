#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading;
using System.Threading.Tasks;
using Mediator;
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
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.SportEvents.Commands;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using RFFM.Api.Features.Mobile.PushNotifications;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// One-off cleanup endpoint for calendars polluted by the pre-fix GET /calendar bug
    /// (GetCalendarRequiredParamsTests): league fixtures synced from a stale hardcoded
    /// competition/group ended up filed under the current team even though they belonged to a
    /// different team/season. Deletes only League (EventTypeId=1) SportEvents for one team dated
    /// before a given cutoff — Friendlies, Tournaments, Trainings and anything on/after the
    /// cutoff are left untouched.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class DeleteLeagueMatchesBeforeTests
    {
        private readonly PostgresContainerFixture _fixture;

        public DeleteLeagueMatchesBeforeTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private class NoOpPushNotificationDispatcher : IPushNotificationDispatcher
        {
            public Task DispatchNewsPublishedAsync(string newsId, CancellationToken ct = default) => Task.CompletedTask;
            public Task DispatchCalendarChangedAsync(string eventId, string teamId, CancellationToken ct = default) => Task.CompletedTask;
        }

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
                var claims = new List<Claim>
                {
                    new(ClaimTypes.Name, "test-user"),
                    new(ClaimTypes.Role, "Coach"),
                };
                var identity = new ClaimsIdentity(claims, SchemeName);
                var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName);
                return Task.FromResult(AuthenticateResult.Success(ticket));
            }
        }

        private async Task<(IHost Host, HttpClient Client)> StartHostAsync()
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
                            services.AddSingleton<IPushNotificationDispatcher>(new NoOpPushNotificationDispatcher());
                            services.AddMediator(o => { o.ServiceLifetime = ServiceLifetime.Scoped; });
                        })
                        .Configure(app =>
                        {
                            app.UseRouting();
                            app.UseAuthentication();
                            app.UseAuthorization();
                            app.UseEndpoints(endpoints => new DeleteLeagueMatchesBefore().AddRoutes(endpoints));
                        });
                })
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient());
        }

        private async Task<Team> SeedTeamAsync()
        {
            await using var db = _fixture.CreateDbContext();
            var club = Club.Create($"CleanupTest Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}",
                DateTime.UtcNow,
                DateTime.UtcNow.AddMonths(9),
                isActive: true,
                club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "CleanupTest Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return team;
        }

        [Fact]
        public async Task DeletesOnlyLeagueMatchesBeforeTheCutoff_ForThatTeam()
        {
            var team = await SeedTeamAsync();

            var cutoff = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);
            var oldLeague = SportEvent.CreateNew(
                "vs Old Rival", cutoff.AddMonths(-8), null, null, null,
                null, null, 1, team.Id, null);
            var newLeague = SportEvent.CreateNew(
                "vs New Rival", cutoff.AddDays(10), null, null, null,
                null, null, 1, team.Id, null);
            var oldFriendly = SportEvent.CreateNew(
                "vs Friendly Rival", cutoff.AddMonths(-8), null, null, null,
                null, null, 4, team.Id, null);

            await using (var seedDb = _fixture.CreateDbContext())
            {
                seedDb.SportEvents.AddRange(oldLeague, newLeague, oldFriendly);
                await seedDb.SaveChangesAsync();
            }

            var (host, client) = await StartHostAsync();
            using var _ = host;

            var response = await client.DeleteAsync(
                $"/api/sport-events/{team.Id}/league-matches?before={cutoff:yyyy-MM-dd}");
            response.EnsureSuccessStatusCode();
            var result = await response.Content.ReadFromJsonAsync<DeleteLeagueMatchesBeforeResult>();

            Assert.Equal(1, result!.Deleted);

            await using var readDb = _fixture.CreateDbContext();
            var remaining = await readDb.SportEvents.Where(e => e.TeamId == team.Id).ToListAsync();
            Assert.Equal(2, remaining.Count);
            Assert.Contains(remaining, e => e.Id == newLeague.Id);
            Assert.Contains(remaining, e => e.Id == oldFriendly.Id);
            Assert.DoesNotContain(remaining, e => e.Id == oldLeague.Id);
        }

        [Fact]
        public async Task DoesNotTouchOtherTeams()
        {
            var team = await SeedTeamAsync();
            var otherTeam = await SeedTeamAsync();

            var cutoff = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);
            var otherTeamOldLeague = SportEvent.CreateNew(
                "vs Other Team Rival", cutoff.AddMonths(-8), null, null, null,
                null, null, 1, otherTeam.Id, null);

            await using (var seedDb = _fixture.CreateDbContext())
            {
                seedDb.SportEvents.Add(otherTeamOldLeague);
                await seedDb.SaveChangesAsync();
            }

            var (host, client) = await StartHostAsync();
            using var _ = host;

            var response = await client.DeleteAsync(
                $"/api/sport-events/{team.Id}/league-matches?before={cutoff:yyyy-MM-dd}");
            response.EnsureSuccessStatusCode();
            var result = await response.Content.ReadFromJsonAsync<DeleteLeagueMatchesBeforeResult>();

            Assert.Equal(0, result!.Deleted);

            await using var readDb = _fixture.CreateDbContext();
            Assert.True(await readDb.SportEvents.AnyAsync(e => e.Id == otherTeamOldLeague.Id));
        }
    }
}
