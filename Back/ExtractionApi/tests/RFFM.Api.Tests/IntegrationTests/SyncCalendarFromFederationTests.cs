#nullable enable
using System;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.SportEvents.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Storage;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Proves POST /api/sport-events/sync-calendar (design.md, coach-calendar-friendlies-tournaments):
    /// - existing league (Matches, EventTypeId=1) create/update-by-CodActa behavior is unchanged
    /// - new Friendlies (EventTypeId=4) and Tournaments (EventTypeId=6) arrays upsert idempotently
    ///   instead of duplicating on repeated calls
    /// - a league match and a friendly on the same team/date do not collide with each other
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class SyncCalendarFromFederationTests
    {
        private readonly PostgresContainerFixture _fixture;

        public SyncCalendarFromFederationTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private class NoopStorageService : IStorageService
        {
            public Task<string> UploadAsync(string bucket, string filePath, IFormFile file, CancellationToken cancellationToken)
                => Task.FromResult(filePath);
            public Task<string> UploadBytesAsync(string bucket, string filePath, byte[] content, string contentType, CancellationToken cancellationToken)
                => Task.FromResult(filePath);
            public Task<bool> DeleteAsync(string bucket, string filePath, CancellationToken cancellationToken)
                => Task.FromResult(true);
            public Task<(byte[] Content, string ContentType)?> DownloadAsync(string url, CancellationToken cancellationToken)
                => Task.FromResult<(byte[] Content, string ContentType)?>(null);
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
                            services.AddDbContext<AppDbContext>(options =>
                            {
                                options.UseNpgsql(_fixture.ConnectionString, npgsql =>
                                {
                                    npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "app");
                                });
                            });
                            services.AddSingleton<IStorageService>(new NoopStorageService());
                            services.AddEasyCaching(options => { options.UseInMemory(Cache.CacheDefaultName); });
                        })
                        .Configure(app =>
                        {
                            app.UseRouting();
                            app.UseEndpoints(endpoints => new SyncCalendarFromFederation().AddRoutes(endpoints));
                        });
                })
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient());
        }

        private async Task<Team> SeedTeamAsync()
        {
            await using var db = _fixture.CreateDbContext();
            var club = Club.Create($"SyncCalendar Test Club {Guid.NewGuid():N}", 1);
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
                Name = "SyncCalendar Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return team;
        }

        [Fact]
        public async Task Sync_MatchesOnly_UnchangedBehavior_CreatesThenUpdatesByCodActa()
        {
            var team = await SeedTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var matchItem = new SyncMatchItem(
                RivalName: "CD Liga Rival",
                RivalShieldUrl: null,
                MatchDate: DateTime.UtcNow.Date.AddDays(7),
                MatchTime: "17:00",
                Field: "Campo Municipal",
                IsHomeMatch: true,
                CodActa: "ACTA-1",
                LocalGoals: null,
                VisitorGoals: null);

            var request = new SyncCalendarRequest(team.Id, new[] { matchItem }, null);

            var firstResponse = await client.PostAsJsonAsync("/api/sport-events/sync-calendar", request);
            firstResponse.EnsureSuccessStatusCode();
            var firstResult = await firstResponse.Content.ReadFromJsonAsync<SyncCalendarResponse>();
            Assert.Equal(1, firstResult!.Created);
            Assert.Equal(0, firstResult.Updated);

            var secondResponse = await client.PostAsJsonAsync("/api/sport-events/sync-calendar", request);
            secondResponse.EnsureSuccessStatusCode();
            var secondResult = await secondResponse.Content.ReadFromJsonAsync<SyncCalendarResponse>();
            Assert.Equal(0, secondResult!.Created);
            Assert.Equal(1, secondResult.Updated);

            await using var readDb = _fixture.CreateDbContext();
            var events = await readDb.SportEvents.Where(e => e.TeamId == team.Id).ToListAsync();
            Assert.Single(events);
            Assert.Equal(1, events[0].EventTypeId);
        }

        [Fact]
        public async Task Sync_MatchWithoutTime_CreatesEventWithNullStartTime()
        {
            var team = await SeedTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var matchItem = new SyncMatchItem(
                RivalName: "CD Liga Sin Hora",
                RivalShieldUrl: null,
                MatchDate: DateTime.UtcNow.Date.AddDays(7),
                MatchTime: null,
                Field: "Campo Municipal",
                IsHomeMatch: true,
                CodActa: "ACTA-SIN-HORA",
                LocalGoals: null,
                VisitorGoals: null);

            var request = new SyncCalendarRequest(team.Id, new[] { matchItem }, null);

            var response = await client.PostAsJsonAsync("/api/sport-events/sync-calendar", request);
            response.EnsureSuccessStatusCode();
            var result = await response.Content.ReadFromJsonAsync<SyncCalendarResponse>();

            Assert.Equal(1, result!.Created);
            Assert.NotNull(result.Events[0].EveDateTime);
            Assert.Null(result.Events[0].StartTime);

            await using var readDb = _fixture.CreateDbContext();
            var stored = await readDb.SportEvents.SingleAsync(e => e.TeamId == team.Id);
            Assert.Null(stored.StartTime);
        }

        [Fact]
        public async Task Sync_MatchTimeLaterRemovedByFederation_ClearsPreviouslyStoredStartTime()
        {
            var team = await SeedTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var withTime = new SyncMatchItem(
                RivalName: "CD Liga Hora Retirada",
                RivalShieldUrl: null,
                MatchDate: DateTime.UtcNow.Date.AddDays(7),
                MatchTime: "17:00",
                Field: "Campo Municipal",
                IsHomeMatch: true,
                CodActa: "ACTA-HORA-RETIRADA",
                LocalGoals: null,
                VisitorGoals: null);

            var firstResponse = await client.PostAsJsonAsync(
                "/api/sport-events/sync-calendar",
                new SyncCalendarRequest(team.Id, new[] { withTime }, null));
            firstResponse.EnsureSuccessStatusCode();

            var withoutTime = withTime with { MatchTime = null };
            var secondResponse = await client.PostAsJsonAsync(
                "/api/sport-events/sync-calendar",
                new SyncCalendarRequest(team.Id, new[] { withoutTime }, null));
            secondResponse.EnsureSuccessStatusCode();

            await using var readDb = _fixture.CreateDbContext();
            var stored = await readDb.SportEvents.SingleAsync(e => e.TeamId == team.Id);
            Assert.Null(stored.StartTime);
        }

        [Fact]
        public async Task Sync_FriendlyItem_CreatesSportEventWithFriendlyEventType()
        {
            var team = await SeedTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var friendlyItem = new SyncMatchItem(
                RivalName: "CD Amistoso Rival",
                RivalShieldUrl: null,
                MatchDate: DateTime.UtcNow.Date.AddDays(3),
                MatchTime: "18:00",
                Field: "Campo Anexo",
                IsHomeMatch: true,
                CodActa: null,
                LocalGoals: null,
                VisitorGoals: null);

            var request = new SyncCalendarRequest(team.Id, Array.Empty<SyncMatchItem>(), null, new[] { friendlyItem });

            var response = await client.PostAsJsonAsync("/api/sport-events/sync-calendar", request);
            response.EnsureSuccessStatusCode();
            var result = await response.Content.ReadFromJsonAsync<SyncCalendarResponse>();

            Assert.Equal(1, result!.Created);
            Assert.Single(result.Events);
            Assert.Equal(4, result.Events[0].EventTypeId);
        }

        [Fact]
        public async Task Sync_FriendlyItem_CalledTwice_UpdatesInsteadOfDuplicating()
        {
            var team = await SeedTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var friendlyItem = new SyncMatchItem(
                RivalName: "CD Amistoso Repetido",
                RivalShieldUrl: null,
                MatchDate: DateTime.UtcNow.Date.AddDays(4),
                MatchTime: "18:00",
                Field: "Campo Anexo",
                IsHomeMatch: true,
                CodActa: null,
                LocalGoals: null,
                VisitorGoals: null);

            var request = new SyncCalendarRequest(team.Id, Array.Empty<SyncMatchItem>(), null, new[] { friendlyItem });

            var firstResponse = await client.PostAsJsonAsync("/api/sport-events/sync-calendar", request);
            firstResponse.EnsureSuccessStatusCode();

            var secondResponse = await client.PostAsJsonAsync("/api/sport-events/sync-calendar", request);
            secondResponse.EnsureSuccessStatusCode();
            var secondResult = await secondResponse.Content.ReadFromJsonAsync<SyncCalendarResponse>();

            Assert.Equal(0, secondResult!.Created);
            Assert.Equal(1, secondResult.Updated);

            await using var readDb = _fixture.CreateDbContext();
            var friendlies = await readDb.SportEvents.Where(e => e.TeamId == team.Id && e.EventTypeId == 4).ToListAsync();
            Assert.Single(friendlies);
        }

        [Fact]
        public async Task Sync_TournamentItem_CreatesSportEventWithTournamentEventType()
        {
            var team = await SeedTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var tournamentItem = new SyncMatchItem(
                RivalName: "CD Torneo Rival",
                RivalShieldUrl: null,
                MatchDate: DateTime.UtcNow.Date.AddDays(10),
                MatchTime: "10:00",
                Field: "Ciudad Deportiva",
                IsHomeMatch: false,
                CodActa: null,
                LocalGoals: null,
                VisitorGoals: null);

            var request = new SyncCalendarRequest(team.Id, Array.Empty<SyncMatchItem>(), null, null, new[] { tournamentItem });

            var response = await client.PostAsJsonAsync("/api/sport-events/sync-calendar", request);
            response.EnsureSuccessStatusCode();
            var result = await response.Content.ReadFromJsonAsync<SyncCalendarResponse>();

            Assert.Equal(1, result!.Created);
            Assert.Single(result.Events);
            Assert.Equal(6, result.Events[0].EventTypeId);
        }

        [Fact]
        public async Task Sync_TournamentItem_CalledTwice_UpdatesInsteadOfDuplicating()
        {
            var team = await SeedTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var tournamentItem = new SyncMatchItem(
                RivalName: "CD Torneo Repetido",
                RivalShieldUrl: null,
                MatchDate: DateTime.UtcNow.Date.AddDays(11),
                MatchTime: "10:00",
                Field: "Ciudad Deportiva",
                IsHomeMatch: false,
                CodActa: null,
                LocalGoals: null,
                VisitorGoals: null);

            var request = new SyncCalendarRequest(team.Id, Array.Empty<SyncMatchItem>(), null, null, new[] { tournamentItem });

            var firstResponse = await client.PostAsJsonAsync("/api/sport-events/sync-calendar", request);
            firstResponse.EnsureSuccessStatusCode();

            var secondResponse = await client.PostAsJsonAsync("/api/sport-events/sync-calendar", request);
            secondResponse.EnsureSuccessStatusCode();
            var secondResult = await secondResponse.Content.ReadFromJsonAsync<SyncCalendarResponse>();

            Assert.Equal(0, secondResult!.Created);
            Assert.Equal(1, secondResult.Updated);

            await using var readDb = _fixture.CreateDbContext();
            var tournaments = await readDb.SportEvents.Where(e => e.TeamId == team.Id && e.EventTypeId == 6).ToListAsync();
            Assert.Single(tournaments);
        }

        [Fact]
        public async Task Sync_FriendlyAndLeagueMatch_SameTeamSameDate_DoNotCollide()
        {
            var team = await SeedTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var sameDate = DateTime.UtcNow.Date.AddDays(14);

            var leagueItem = new SyncMatchItem(
                RivalName: "CD Liga Mismo Dia",
                RivalShieldUrl: null,
                MatchDate: sameDate,
                MatchTime: "12:00",
                Field: "Campo Municipal",
                IsHomeMatch: true,
                CodActa: null,
                LocalGoals: null,
                VisitorGoals: null);

            var friendlyItem = new SyncMatchItem(
                RivalName: "CD Amistoso Mismo Dia",
                RivalShieldUrl: null,
                MatchDate: sameDate,
                MatchTime: "18:00",
                Field: "Campo Anexo",
                IsHomeMatch: true,
                CodActa: null,
                LocalGoals: null,
                VisitorGoals: null);

            var request = new SyncCalendarRequest(team.Id, new[] { leagueItem }, null, new[] { friendlyItem });

            var response = await client.PostAsJsonAsync("/api/sport-events/sync-calendar", request);
            response.EnsureSuccessStatusCode();
            var result = await response.Content.ReadFromJsonAsync<SyncCalendarResponse>();

            Assert.Equal(2, result!.Created);

            await using var readDb = _fixture.CreateDbContext();
            var events = await readDb.SportEvents.Where(e => e.TeamId == team.Id).ToListAsync();
            Assert.Equal(2, events.Count);
            Assert.Contains(events, e => e.EventTypeId == 1);
            Assert.Contains(events, e => e.EventTypeId == 4);
        }
    }
}
