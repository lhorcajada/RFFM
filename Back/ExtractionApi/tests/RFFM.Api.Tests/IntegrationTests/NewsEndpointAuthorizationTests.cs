#nullable enable
using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading.Tasks;
using FluentValidation;
using Hellang.Middleware.ProblemDetails;
using Mediator;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.DependencyInjection;
using RFFM.Api.Domain.Entities.News;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.News;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services;
using RFFM.Api.Infrastructure.Storage;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Authorization tests for News endpoints covering role-based access (Coach/Administrator only for writes,
    /// any authenticated role for reads of published items, drafts hidden from non-coach roles).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class NewsEndpointAuthorizationTests
    {
        private readonly PostgresContainerFixture _fixture;

        public NewsEndpointAuthorizationTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
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
                var role = Request.Headers.TryGetValue("X-Test-Role", out var values)
                    ? values.ToString()
                    : string.Empty;

                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.Name, "test-user"),
                };
                if (!string.IsNullOrEmpty(role))
                {
                    claims.Add(new Claim(ClaimTypes.Role, role));
                }

                var identity = new ClaimsIdentity(claims, SchemeName);
                var principal = new ClaimsPrincipal(identity);
                var ticket = new AuthenticationTicket(principal, SchemeName);
                return Task.FromResult(AuthenticateResult.Success(ticket));
            }
        }

        /// <summary>
        /// Spy standing in for the real ExpoPushService-backed dispatcher in this minimal test
        /// host. Tests in this class run sequentially (shared PostgresCollection), so a static
        /// call counter reset at the start of each test that cares about it is safe.
        /// </summary>
        private class NoOpPushNotificationDispatcher : RFFM.Api.Features.Mobile.PushNotifications.IPushNotificationDispatcher
        {
            public static int NewsPublishedCallCount;
            public static string? LastNewsId;

            public Task DispatchNewsPublishedAsync(string newsId, CancellationToken ct = default)
            {
                NewsPublishedCallCount++;
                LastNewsId = newsId;
                return Task.CompletedTask;
            }

            public Task DispatchCalendarChangedAsync(string eventId, string teamId, CancellationToken ct = default) => Task.CompletedTask;
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
                            // UseProblemDetails() -> ObjectResultExecutor needs MVC's
                            // OutputFormatterSelector registered, mirroring AddAppServices'
                            // services.AddControllers() in production.
                            services.AddControllers();
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
                            services.AddHttpContextAccessor();
                            services.AddSingleton<IConfiguration>(new ConfigurationBuilder().Build());
                            services.AddScoped<ICurrentUserService, CurrentUserService>();
                            services.AddScoped<IStorageService, LocalStorageService>();

                            // News uses the standard Mediator vertical slice (ICommand/IQueryApp,
                            // FluentValidation, caching) — unlike SetPlayerSanction's inline
                            // AppDbContext-only handlers, so the test host needs the full
                            // pipeline wired, mirroring AddAppServices/AddBehaviors in
                            // ServiceCollectionExtensions.cs.
                            services.AddCustomProblemDetails()
                                .AddMediator(o => { o.ServiceLifetime = ServiceLifetime.Scoped; });

                            services
                                .AddTransient(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>))
                                .AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>))
                                .AddTransient(typeof(IPipelineBehavior<,>), typeof(TimeLoggingBehavior<,>))
                                .AddTransient(typeof(IPipelineBehavior<,>), typeof(FeaturePermissionBehavior<,>))
                                .AddTransient(typeof(IPipelineBehavior<,>), typeof(TeamMembershipBehavior<,>))
                                .AddTransient(typeof(IPipelineBehavior<,>), typeof(CachingBehavior<,>))
                                .AddTransient(typeof(IPipelineBehavior<,>), typeof(InvalidateCachingBehavior<,>));

                            services.AddEasyCaching(options => { options.UseInMemory(Cache.CacheDefaultName); });

                            services.AddScoped<IValidator<CreateNewsCommand>, CreateNewsValidator>();
                            services.AddScoped<IValidator<UpdateNewsCommand>, UpdateNewsValidator>();
                            services.AddScoped<IValidator<UploadNewsImageCommand>, UploadNewsImageValidator>();

                            // PublishNewsHandler depends on IPushNotificationDispatcher (dispatches
                            // a push notification after publish); this minimal test host doesn't go
                            // through AddAppServices, so it must be registered explicitly for
                            // Mediator's DI resolution to succeed. A no-op stub is enough here —
                            // dispatcher behavior itself is covered by PushNotificationDispatcherTests.
                            services.AddScoped<RFFM.Api.Features.Mobile.PushNotifications.IPushNotificationDispatcher, NoOpPushNotificationDispatcher>();
                        })
                        .Configure(app =>
                        {
                            app.UseProblemDetails();
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

        // News has no per-club/team scoping (design.md Non-Goals) and every test in this
        // collection shares one Postgres container for the whole run, so tests asserting exact
        // counts of published/draft items need a clean table first.
        private async Task ClearNewsTableAsync()
        {
            await using var db = _fixture.CreateDbContext();
            db.News.RemoveRange(db.News);
            await db.SaveChangesAsync();
        }

        private async Task<NewsItem> CreateNewsItemAsync(NewsStatus status)
        {
            await using var db = _fixture.CreateDbContext();
            var news = NewsItem.Create("Test News", "Test Subtitle", "Test Body", "https://example.com/test.jpg", status, new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc));
            db.News.Add(news);
            await db.SaveChangesAsync();
            return news;
        }

        // POST /api/coach/news tests
        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task CreateNews_WithDisallowedRole_ReturnsForbidden(string role)
        {
            var (host, client) = await StartHostAsync(new CreateNews());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, "/api/coach/news")
            {
                Content = JsonContent.Create(new CreateNewsCommand("Title", "Sub", "Body", "url", "Draft", new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc)))
            };
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task CreateNews_WithCoachRole_ReturnsCreated()
        {
            var (host, client) = await StartHostAsync(new CreateNews());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, "/api/coach/news")
            {
                Content = JsonContent.Create(new CreateNewsCommand("Title", "Sub", "Body", "https://example.com/image.jpg", "Draft", new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc)))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        }

        // Mobile sends newsDate as a bare "YYYY-MM-DD" string with no time-of-day/offset.
        // System.Text.Json deserializes that into a DateTime with Kind=Unspecified, which
        // Npgsql rejects when writing to a `timestamp with time zone` column unless the
        // entity normalizes it to Kind=Utc first (see NewsItem.Create/UpdateContent).
        [Fact]
        public async Task CreateNews_WithDateOnlyNewsDate_ReturnsCreated()
        {
            var (host, client) = await StartHostAsync(new CreateNews());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, "/api/coach/news")
            {
                Content = new StringContent(
                    "{\"title\":\"Title\",\"subtitle\":\"Sub\",\"body\":\"Body\",\"coverImageUrl\":\"https://example.com/image.jpg\",\"status\":\"Draft\",\"newsDate\":\"2026-08-15\"}",
                    System.Text.Encoding.UTF8,
                    "application/json")
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        }

        [Fact]
        public async Task CreateNews_MissingCoverImageUrl_ReturnsBadRequest()
        {
            var (host, client) = await StartHostAsync(new CreateNews());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, "/api/coach/news")
            {
                Content = JsonContent.Create(new CreateNewsCommand("Title", "Sub", "Body", "", "Draft", new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc)))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        // PUT /api/coach/news/{id} tests
        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task UpdateNews_WithDisallowedRole_ReturnsForbidden(string role)
        {
            var news = await CreateNewsItemAsync(NewsStatus.Draft);
            var (host, client) = await StartHostAsync(new UpdateNews());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Put, $"/api/coach/news/{news.Id}")
            {
                Content = JsonContent.Create(new UpdateNewsCommand("New Title", "New Sub", "New Body", "url", new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc)))
            };
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task UpdateNews_WithCoachRole_ReturnsNoContent()
        {
            var news = await CreateNewsItemAsync(NewsStatus.Draft);
            var (host, client) = await StartHostAsync(new UpdateNews());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Put, $"/api/coach/news/{news.Id}")
            {
                Content = JsonContent.Create(new UpdateNewsCommand("New Title", "New Sub", "New Body", "https://example.com/new.jpg", new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc)))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        }

        [Fact]
        public async Task UpdateNews_WithDateOnlyNewsDate_ReturnsNoContent()
        {
            var news = await CreateNewsItemAsync(NewsStatus.Draft);
            var (host, client) = await StartHostAsync(new UpdateNews());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Put, $"/api/coach/news/{news.Id}")
            {
                Content = new StringContent(
                    "{\"title\":\"New Title\",\"subtitle\":\"New Sub\",\"body\":\"New Body\",\"coverImageUrl\":\"https://example.com/new.jpg\",\"newsDate\":\"2026-08-15\"}",
                    System.Text.Encoding.UTF8,
                    "application/json")
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        }

        [Fact]
        public async Task UpdateNews_WithNonExistentId_ReturnsNotFound()
        {
            var (host, client) = await StartHostAsync(new UpdateNews());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Put, "/api/coach/news/nonexistent")
            {
                Content = JsonContent.Create(new UpdateNewsCommand("Title", "Sub", "Body", "url", new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc)))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        // POST /api/coach/news/{id}/publish tests
        [Fact]
        public async Task PublishNews_DraftToPublished_ReturnsOk()
        {
            var news = await CreateNewsItemAsync(NewsStatus.Draft);
            NoOpPushNotificationDispatcher.NewsPublishedCallCount = 0;
            NoOpPushNotificationDispatcher.LastNewsId = null;
            var (host, client) = await StartHostAsync(new PublishNews());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/coach/news/{news.Id}/publish");
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(1, NoOpPushNotificationDispatcher.NewsPublishedCallCount);
            Assert.Equal(news.Id, NoOpPushNotificationDispatcher.LastNewsId);
        }

        [Fact]
        public async Task PublishNews_AlreadyPublished_ReturnsConflict()
        {
            var news = await CreateNewsItemAsync(NewsStatus.Published);
            var (host, client) = await StartHostAsync(new PublishNews());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/coach/news/{news.Id}/publish");
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        }

        // DELETE /api/coach/news/{id} tests
        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task DeleteNews_WithDisallowedRole_ReturnsForbidden(string role)
        {
            var news = await CreateNewsItemAsync(NewsStatus.Draft);
            var (host, client) = await StartHostAsync(new DeleteNews());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/coach/news/{news.Id}");
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task DeleteNews_WithCoachRole_ReturnsNoContent()
        {
            var news = await CreateNewsItemAsync(NewsStatus.Draft);
            var (host, client) = await StartHostAsync(new DeleteNews());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/coach/news/{news.Id}");
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        }

        // GET /api/coach/news tests
        [Fact]
        public async Task GetNews_WithFamilyMember_ReturnsOnlyPublished()
        {
            await ClearNewsTableAsync();
            var draft = await CreateNewsItemAsync(NewsStatus.Draft);
            var published = await CreateNewsItemAsync(NewsStatus.Published);

            var (host, client) = await StartHostAsync(new GetNews());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, "/api/coach/news?pageNumber=1&pageSize=20");
            request.Headers.Add("X-Test-Role", "FamilyMember");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var content = await response.Content.ReadFromJsonAsync<NewsSummaryResponse[]>();
            Assert.Single(content);
            Assert.Equal(published.Id, content[0].Id);
        }

        // GET /api/coach/news/drafts tests
        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task GetNewsDrafts_WithDisallowedRole_ReturnsForbidden(string role)
        {
            var (host, client) = await StartHostAsync(new GetNewsDrafts());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, "/api/coach/news/drafts?pageNumber=1&pageSize=20");
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task GetNewsDrafts_WithCoachRole_ReturnsOnlyDrafts()
        {
            await ClearNewsTableAsync();
            var draft1 = await CreateNewsItemAsync(NewsStatus.Draft);
            var draft2 = await CreateNewsItemAsync(NewsStatus.Draft);
            var published = await CreateNewsItemAsync(NewsStatus.Published);

            var (host, client) = await StartHostAsync(new GetNewsDrafts());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, "/api/coach/news/drafts?pageNumber=1&pageSize=20");
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var content = await response.Content.ReadFromJsonAsync<NewsSummaryResponse[]>();
            Assert.Equal(2, content.Length);
            Assert.Contains(content, c => c.Id == draft1.Id);
            Assert.Contains(content, c => c.Id == draft2.Id);
            Assert.DoesNotContain(content, c => c.Id == published.Id);
        }

        // GET /api/coach/news/{id} tests
        [Fact]
        public async Task GetNewsById_PublishedItem_AnyRoleCanView()
        {
            var published = await CreateNewsItemAsync(NewsStatus.Published);

            var (host, client) = await StartHostAsync(new GetNewsById());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/coach/news/{published.Id}");
            request.Headers.Add("X-Test-Role", "FamilyMember");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        [Fact]
        public async Task GetNewsById_DraftItemAsCoach_ReturnsOk()
        {
            var draft = await CreateNewsItemAsync(NewsStatus.Draft);

            var (host, client) = await StartHostAsync(new GetNewsById());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/coach/news/{draft.Id}");
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        [Fact]
        public async Task GetNewsById_DraftItemAsFamilyMember_ReturnsNotFound()
        {
            var draft = await CreateNewsItemAsync(NewsStatus.Draft);

            var (host, client) = await StartHostAsync(new GetNewsById());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/coach/news/{draft.Id}");
            request.Headers.Add("X-Test-Role", "FamilyMember");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task GetNewsById_UnknownId_ReturnsNotFound()
        {
            var (host, client) = await StartHostAsync(new GetNewsById());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, "/api/coach/news/nonexistent-id");
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }
    }
}
