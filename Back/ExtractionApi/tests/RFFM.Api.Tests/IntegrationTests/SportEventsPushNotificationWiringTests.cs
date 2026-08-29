#nullable enable
using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.SportEvents.Commands;
using RFFM.Api.Features.Mobile.PushNotifications;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Proves CreateSportEvent/UpdateSportEvent — raw Minimal API lambdas, not Mediator commands
    /// (design.md §2: they predate the Features/Mobile/* convention) — call
    /// IPushNotificationDispatcher.DispatchCalendarChangedAsync after their SaveChangesAsync.
    /// Uses a minimal TestServer host mirroring NewsEndpointAuthorizationTests.StartHostAsync,
    /// scoped down to what these unauthenticated raw-lambda endpoints actually need (no auth, no
    /// Mediator pipeline — CreateSportEvent/UpdateSportEvent never route through IMediator).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class SportEventsPushNotificationWiringTests
    {
        private readonly PostgresContainerFixture _fixture;

        public SportEventsPushNotificationWiringTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private class SpyPushNotificationDispatcher : IPushNotificationDispatcher
        {
            public int CalendarChangedCallCount;
            public string? LastEventId;
            public string? LastTeamId;

            public Task DispatchNewsPublishedAsync(string newsId, CancellationToken ct = default) => Task.CompletedTask;

            public Task DispatchCalendarChangedAsync(string eventId, string teamId, CancellationToken ct = default)
            {
                CalendarChangedCallCount++;
                LastEventId = eventId;
                LastTeamId = teamId;
                return Task.CompletedTask;
            }
        }

        private async Task<(IHost Host, HttpClient Client, SpyPushNotificationDispatcher Spy)> StartHostAsync(IFeatureModule module)
        {
            var spy = new SpyPushNotificationDispatcher();
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
                            services.AddSingleton<IPushNotificationDispatcher>(spy);
                            services.AddScoped<FluentValidation.IValidator<CreateSportEventRequest>, CreateSportEventValidator>();
                            services.AddEasyCaching(options => { options.UseInMemory(Cache.CacheDefaultName); });
                        })
                        .Configure(app =>
                        {
                            app.UseRouting();
                            app.UseEndpoints(endpoints => module.AddRoutes(endpoints));
                        });
                })
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient(), spy);
        }

        private async Task<Team> SeedTeamAsync()
        {
            await using var db = _fixture.CreateDbContext();
            var club = Club.Create($"SportEvent Push Test Club {Guid.NewGuid():N}", 1);
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
                Name = "SportEvent Push Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return team;
        }

        [Fact]
        public async Task CreateSportEvent_AfterSave_DispatchesCalendarChanged()
        {
            var team = await SeedTeamAsync();
            var (host, client, spy) = await StartHostAsync(new CreateSportEvent());
            using var _ = host;

            var request = new CreateSportEventRequest(
                Name: "Entrenamiento",
                EveDateTime: DateTime.UtcNow.AddDays(1),
                StartTime: DateTime.UtcNow.AddDays(1),
                EndTime: null,
                ArrivalDate: null,
                Location: null,
                Description: null,
                EventTypeId: 2,
                TeamId: team.Id,
                RivalId: null,
                IsHomeMatch: null,
                CodActa: null
            );

            var response = await client.PostAsJsonAsync("/api/sport-events", request);
            response.EnsureSuccessStatusCode();
            var created = await response.Content.ReadFromJsonAsync<SportEventSaveResponse>();

            Assert.Equal(1, spy.CalendarChangedCallCount);
            Assert.Equal(created!.Id, spy.LastEventId);
            Assert.Equal(team.Id, spy.LastTeamId);
        }

        [Fact]
        public async Task UpdateSportEvent_AfterSave_DispatchesCalendarChanged()
        {
            var team = await SeedTeamAsync();
            await using var seedDb = _fixture.CreateDbContext();
            var ev = RFFM.Api.Domain.Aggregates.Assistances.SportEvent.CreateNew(
                "Original", DateTime.UtcNow.AddDays(1), DateTime.UtcNow.AddDays(1), null, null, null, null, 2, team.Id, null);
            seedDb.SportEvents.Add(ev);
            await seedDb.SaveChangesAsync();

            var (host, client, spy) = await StartHostAsync(new UpdateSportEvent());
            using var _ = host;

            var request = new UpdateSportEventRequest(
                Name: "Actualizado",
                EveDateTime: DateTime.UtcNow.AddDays(2),
                StartTime: DateTime.UtcNow.AddDays(2),
                EndTime: null,
                ArrivalDate: null,
                Location: null,
                Description: null,
                EventTypeId: 2,
                RivalId: null,
                IsHomeMatch: null,
                CodActa: null
            );

            var response = await client.PutAsJsonAsync($"/api/sport-events/{ev.Id}", request);
            response.EnsureSuccessStatusCode();

            Assert.Equal(1, spy.CalendarChangedCallCount);
            Assert.Equal(ev.Id, spy.LastEventId);
            Assert.Equal(team.Id, spy.LastTeamId);
        }
    }
}
