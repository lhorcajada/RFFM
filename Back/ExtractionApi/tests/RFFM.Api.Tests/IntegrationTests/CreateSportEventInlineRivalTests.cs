#nullable enable
using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.DependencyInjection;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Rivals.Queries;
using RFFM.Api.Features.Coaches.SportEvents.Commands;
using RFFM.Api.Features.Mobile.PushNotifications;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Proves POST /api/sport-events (design.md, nullable-event-datetime-and-inline-rival):
    /// - creates an event without eveDateTime/startTime
    /// - creates+links a brand-new Rival via `newRival`, alternative to `rivalId`
    /// - rejects rivalId+newRival together, an empty newRival.name, and recurrence without a date
    /// via CreateSportEventValidator, now actually wired into the endpoint (design.md §5).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class CreateSportEventInlineRivalTests
    {
        private readonly PostgresContainerFixture _fixture;

        public CreateSportEventInlineRivalTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private class NoopPushNotificationDispatcher : IPushNotificationDispatcher
        {
            public Task DispatchNewsPublishedAsync(string newsId, CancellationToken ct = default) => Task.CompletedTask;
            public Task DispatchCalendarChangedAsync(string eventId, string teamId, CancellationToken ct = default) => Task.CompletedTask;
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
                            services.AddSingleton<IPushNotificationDispatcher>(new NoopPushNotificationDispatcher());
                            services.AddScoped<FluentValidation.IValidator<CreateSportEventRequest>, CreateSportEventValidator>();
                            services.AddEasyCaching(options => { options.UseInMemory(Cache.CacheDefaultName); });
                        })
                        .Configure(app =>
                        {
                            app.UseRouting();
                            app.UseEndpoints(endpoints => new CreateSportEvent().AddRoutes(endpoints));
                        });
                })
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient());
        }

        /// <summary>
        /// Same as StartHostAsync but also wires the Mediator + Caching pipeline and
        /// GET /api/rivals, so the "Rivals" cache invalidation performed by CreateSportEvent
        /// when a `newRival` is supplied can be observed end-to-end (regression for the bug
        /// where GetRivals kept serving the stale cached list after an inline rival creation).
        /// </summary>
        private async Task<(IHost Host, HttpClient Client)> StartHostWithRivalsCacheAsync()
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
                            services.AddSingleton<IPushNotificationDispatcher>(new NoopPushNotificationDispatcher());
                            services.AddScoped<FluentValidation.IValidator<CreateSportEventRequest>, CreateSportEventValidator>();

                            services.AddCustomProblemDetails()
                                .AddMediator(o => { o.ServiceLifetime = ServiceLifetime.Scoped; });

                            services
                                .AddTransient(typeof(IPipelineBehavior<,>), typeof(CachingBehavior<,>))
                                .AddTransient(typeof(IPipelineBehavior<,>), typeof(InvalidateCachingBehavior<,>));

                            services.AddEasyCaching(options => { options.UseInMemory(Cache.CacheDefaultName); });
                        })
                        .Configure(app =>
                        {
                            app.UseRouting();
                            app.UseEndpoints(endpoints =>
                            {
                                new CreateSportEvent().AddRoutes(endpoints);
                                new GetRivals().AddRoutes(endpoints);
                            });
                        });
                })
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient());
        }

        private async Task<Team> SeedTeamAsync()
        {
            await using var db = _fixture.CreateDbContext();
            var club = Club.Create($"CreateSportEvent Rival Test Club {Guid.NewGuid():N}", 1);
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
                Name = "CreateSportEvent Rival Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return team;
        }

        [Fact]
        public async Task CreateSportEvent_WithoutDate_Succeeds()
        {
            var team = await SeedTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var request = new CreateSportEventRequest(
                Name: "Amistoso sin fecha",
                EveDateTime: null,
                StartTime: null,
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

            Assert.NotNull(created);
            Assert.Null(created!.EveDateTime);
            Assert.Null(created.StartTime);
        }

        [Fact]
        public async Task CreateSportEvent_WithNewRival_CreatesAndLinksRival()
        {
            var team = await SeedTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var request = new CreateSportEventRequest(
                Name: "Partido con rival nuevo",
                EveDateTime: DateTime.UtcNow.AddDays(1),
                StartTime: DateTime.UtcNow.AddDays(1),
                EndTime: null,
                ArrivalDate: null,
                Location: null,
                Description: null,
                EventTypeId: 2,
                TeamId: team.Id,
                RivalId: null,
                IsHomeMatch: true,
                CodActa: null,
                NewRival: new NewRivalRequest("CD Rival Nuevo", null, null)
            );

            var response = await client.PostAsJsonAsync("/api/sport-events", request);
            response.EnsureSuccessStatusCode();
            var created = await response.Content.ReadFromJsonAsync<SportEventSaveResponse>();

            Assert.NotNull(created);
            Assert.NotNull(created!.RivalId);

            await using var readDb = _fixture.CreateDbContext();
            var rival = await readDb.Rivals.SingleOrDefaultAsync(r => r.Id == created.RivalId);
            Assert.NotNull(rival);
            Assert.Equal("CD Rival Nuevo", rival!.Name);
        }

        [Fact]
        public async Task CreateSportEvent_WithNewRival_InvalidatesRivalsCacheSoGetRivalsIncludesIt()
        {
            var team = await SeedTeamAsync();
            var (host, client) = await StartHostWithRivalsCacheAsync();
            using var _ = host;

            // Warm the "Rivals" cache the way real usage would (e.g. opening the rival dropdown
            // before creating the match).
            var warmupResponse = await client.GetAsync("/api/rivals");
            warmupResponse.EnsureSuccessStatusCode();

            var rivalName = $"CD Cache Regression {Guid.NewGuid():N}";
            var request = new CreateSportEventRequest(
                Name: "Partido con rival nuevo (regresion cache)",
                EveDateTime: DateTime.UtcNow.AddDays(1),
                StartTime: DateTime.UtcNow.AddDays(1),
                EndTime: null,
                ArrivalDate: null,
                Location: null,
                Description: null,
                EventTypeId: 2,
                TeamId: team.Id,
                RivalId: null,
                IsHomeMatch: true,
                CodActa: null,
                NewRival: new NewRivalRequest(rivalName, null, null)
            );

            var createResponse = await client.PostAsJsonAsync("/api/sport-events", request);
            createResponse.EnsureSuccessStatusCode();
            var created = await createResponse.Content.ReadFromJsonAsync<SportEventSaveResponse>();
            Assert.NotNull(created);
            Assert.NotNull(created!.RivalId);

            var rivalsAfterCreate = await client.GetFromJsonAsync<GetRivals.RivalResponse[]>("/api/rivals");
            Assert.NotNull(rivalsAfterCreate);
            Assert.Contains(rivalsAfterCreate!, r => r.Id == created.RivalId && r.Name == rivalName);
        }

        [Fact]
        public async Task CreateSportEvent_WithRivalIdAndNewRival_ReturnsValidationProblem()
        {
            var team = await SeedTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var request = new CreateSportEventRequest(
                Name: "Invalido",
                EveDateTime: DateTime.UtcNow.AddDays(1),
                StartTime: DateTime.UtcNow.AddDays(1),
                EndTime: null,
                ArrivalDate: null,
                Location: null,
                Description: null,
                EventTypeId: 2,
                TeamId: team.Id,
                RivalId: "some-existing-rival-id",
                IsHomeMatch: null,
                CodActa: null,
                NewRival: new NewRivalRequest("CD Rival Nuevo", null, null)
            );

            var response = await client.PostAsJsonAsync("/api/sport-events", request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task CreateSportEvent_WithNewRivalMissingName_ReturnsValidationProblem()
        {
            var team = await SeedTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var request = new CreateSportEventRequest(
                Name: "Invalido",
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
                CodActa: null,
                NewRival: new NewRivalRequest("", null, null)
            );

            var response = await client.PostAsJsonAsync("/api/sport-events", request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task CreateSportEvent_WithRecurrenceAndNoDate_ReturnsValidationProblem()
        {
            var team = await SeedTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var request = new CreateSportEventRequest(
                Name: "Invalido",
                EveDateTime: null,
                StartTime: null,
                EndTime: null,
                ArrivalDate: null,
                Location: null,
                Description: null,
                EventTypeId: 2,
                TeamId: team.Id,
                RivalId: null,
                IsHomeMatch: null,
                CodActa: null,
                Recurrence: new RecurrenceRequest("weekly", DateTime.UtcNow.AddDays(30))
            );

            var response = await client.PostAsJsonAsync("/api/sport-events", request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task CreateSportEvent_WithEmptyName_ReturnsValidationProblem()
        {
            // Confirms the validator is actually wired (previously CreateSportEventValidator
            // existed but nothing invoked it, so an empty Name was silently accepted).
            var team = await SeedTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var request = new CreateSportEventRequest(
                Name: "",
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

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
    }
}
