#nullable enable
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
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
using RFFM.Api.Domain;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Quiniela;
using RFFM.Api.Features.Infrastructure;
using RFFM.Api.Infrastructure.FeatureFlags;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services;
using RFFM.Api.Tests.Fixtures;
using RFFM.Api.Tests.UnitTests;
using Xunit;
using static RFFM.Api.Tests.UnitTests.QuinielaTestSupport;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Endpoints de la quiniela con el pipeline real (validación, ProblemDetails y autorización por pertenencia al equipo).
    /// See openspec/changes/quiniela-team-pool/design.md → D7.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class QuinielaEndpointTests(PostgresContainerFixture fixture)
    {
        private class TestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
            : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
        {
            public const string SchemeName = "Test";

            protected override Task<AuthenticateResult> HandleAuthenticateAsync()
            {
                if (Request.Headers.ContainsKey("X-Test-Anonymous"))
                    return Task.FromResult(AuthenticateResult.NoResult());

                var userId = Request.Headers.TryGetValue("X-Test-User-Id", out var values) ? values.ToString() : "test-user";
                var claims = new List<Claim> { new(ClaimTypes.Name, "test-user"), new(ClaimTypes.NameIdentifier, userId) };
                var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, SchemeName));
                return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, SchemeName)));
            }
        }

        private static readonly IFeatureModule[] Modules =
        [
            new OpenQuiniela(), new GetCurrentQuiniela(), new SaveQuinielaTicket(),
            new GetQuinielaPayments(), new SetQuinielaTicketPayment(), new SettleQuiniela(), new GetFeatureFlags(),
            new TopUpQuinielaWallet(), new AdjustQuinielaWallet(), new GetQuinielaWallet(), new GetQuinielaWallets(), new PayQuinielaTicketWithWallet()
        ];

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
                            services.AddControllers();
                            services.AddAuthentication(TestAuthHandler.SchemeName)
                                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
                            services.AddAuthorization();
                            services.AddDbContext<AppDbContext>(options =>
                                options.UseNpgsql(fixture.ConnectionString, npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "app")));
                            services.AddDbContext<FederationDbContext>(options =>
                                options.UseNpgsql(fixture.ConnectionString, npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "federation")));
                            services.AddHttpContextAccessor();
                            services.AddSingleton<IConfiguration>(new ConfigurationBuilder().Build());
                            services.AddSingleton(ClockAt(BeforeKickoff));
                            services.AddScoped<ICurrentUserService, CurrentUserService>();
                            services.AddCustomProblemDetails()
                                .AddMediator(o => { o.ServiceLifetime = ServiceLifetime.Scoped; });
                            services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
                            services.AddQuinielaValidators();
                            services.AddFeatureFlags();
                        })
                        .Configure(app =>
                        {
                            app.UseProblemDetails();
                            app.UseRouting();
                            app.UseAuthentication();
                            app.UseAuthorization();
                            app.UseEndpoints(endpoints =>
                            {
                                foreach (var module in Modules)
                                    module.AddRoutes(endpoints);
                            });
                        });
                })
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient());
        }

        private static HttpRequestMessage Request(HttpMethod method, string url, string? userId, object? body = null)
        {
            var request = new HttpRequestMessage(method, url);
            if (body is not null)
                request.Content = JsonContent.Create(body);
            if (userId is null)
                request.Headers.Add("X-Test-Anonymous", "1");
            else
                request.Headers.Add("X-Test-User-Id", userId);
            return request;
        }

        private static async Task<string?> ProblemCodeAsync(HttpResponseMessage response)
        {
            var problem = await response.Content.ReadFromJsonAsync<Dictionary<string, object>>();
            return problem is not null && problem.TryGetValue("code", out var code) ? code.ToString() : null;
        }

        private static object Ticket(string suffix, string a = "1", string b = "X", string c = "2") => new
        {
            picks = new[]
            {
                new { recordCode = $"A{suffix}", sign = a },
                new { recordCode = $"B{suffix}", sign = b },
                new { recordCode = $"C{suffix}", sign = c }
            },
            plenoHome = 0,
            plenoAway = 1
        };

        private async Task<(QuinielaSeed Seed, string BaseUrl)> SeedAsync(string suffix)
        {
            var seed = await SeedTeamAsync(fixture);
            await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches(suffix));
            return (seed, $"/api/teams/{seed.TeamId}/quiniela");
        }

        [Fact]
        public async Task EveryEndpoint_RejectsAnonymousCallers()
        {
            var (seed, baseUrl) = await SeedAsync("e1");
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var requests = new[]
            {
                Request(HttpMethod.Post, baseUrl, null),
                Request(HttpMethod.Get, $"{baseUrl}/current", null),
                Request(HttpMethod.Post, $"{baseUrl}/j/my-tickets", null, Ticket("e1")),
                Request(HttpMethod.Get, $"{baseUrl}/j/payments", null),
                Request(HttpMethod.Put, $"{baseUrl}/j/tickets/k/payment", null, new { paid = true, method = "Cash" }),
                Request(HttpMethod.Post, $"{baseUrl}/j/settle", null),
                Request(HttpMethod.Get, $"{baseUrl}/wallet", null),
                Request(HttpMethod.Get, $"{baseUrl}/wallets", null),
                Request(HttpMethod.Post, $"{baseUrl}/wallets/u/top-ups", null, new { amount = 1 }),
                Request(HttpMethod.Post, $"{baseUrl}/wallets/u/adjustments", null, new { amount = 1, reason = "x" }),
                Request(HttpMethod.Post, $"{baseUrl}/j/my-tickets/k/wallet-payment", null)
            };
            foreach (var request in requests)
                Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(request)).StatusCode);
        }

        [Fact]
        public async Task FeatureFlags_RequireAuthentication_AndListTheCatalogWithItsDefaults()
        {
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var anonymous = await client.SendAsync(Request(HttpMethod.Get, "/api/feature-flags", null));
            Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);

            var response = await client.SendAsync(Request(HttpMethod.Get, "/api/feature-flags", "any-user"));
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var flags = await response.Content.ReadFromJsonAsync<Dictionary<string, bool>>();
            Assert.False(flags![FeatureFlagCatalog.QuinielaMultipleTickets]);
        }

        [Fact]
        public async Task Open_ByCoach_Creates_ThenConflictsWhenAlreadyOpen()
        {
            var (seed, baseUrl) = await SeedAsync("e2");
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var created = await client.SendAsync(Request(HttpMethod.Post, baseUrl, seed.CoachId));
            Assert.Equal(HttpStatusCode.Created, created.StatusCode);

            var again = await client.SendAsync(Request(HttpMethod.Post, baseUrl, seed.CoachId));
            Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
            Assert.Equal(ErrorCodes.QuinielaAlreadyOpen, await ProblemCodeAsync(again));
        }

        [Fact]
        public async Task Open_ByPlayer_IsForbidden()
        {
            var (seed, baseUrl) = await SeedAsync("e3");
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var response = await client.SendAsync(Request(HttpMethod.Post, baseUrl, seed.PlayerId));

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task Current_ReportsNotOpen_ThenOpen_AndForbidsFollowers()
        {
            var (seed, baseUrl) = await SeedAsync("e4");
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var before = await (await client.SendAsync(Request(HttpMethod.Get, $"{baseUrl}/current", seed.PlayerId))).Content.ReadFromJsonAsync<QuinielaCurrentDto>();
            Assert.False(before!.IsOpen);

            await client.SendAsync(Request(HttpMethod.Post, baseUrl, seed.CoachId));
            var after = await (await client.SendAsync(Request(HttpMethod.Get, $"{baseUrl}/current", seed.PlayerId))).Content.ReadFromJsonAsync<QuinielaCurrentDto>();
            Assert.True(after!.IsOpen);
            Assert.Equal(3, after.Matches.Count);

            var follower = await client.SendAsync(Request(HttpMethod.Get, $"{baseUrl}/current", seed.FollowerId));
            Assert.Equal(HttpStatusCode.Forbidden, follower.StatusCode);
        }

        [Fact]
        public async Task SaveTicket_ValidatesTheBody_AndForbidsFollowers()
        {
            var (seed, baseUrl) = await SeedAsync("e5");
            var (host, client) = await StartHostAsync();
            using var _ = host;
            var jornada = await (await client.SendAsync(Request(HttpMethod.Post, baseUrl, seed.CoachId))).Content.ReadFromJsonAsync<QuinielaJornadaDto>();
            var url = $"{baseUrl}/{jornada!.Id}/my-tickets";

            var invalid = await client.SendAsync(Request(HttpMethod.Post, url, seed.PlayerId, Ticket("e5", a: "9")));
            Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);

            var follower = await client.SendAsync(Request(HttpMethod.Post, url, seed.FollowerId, Ticket("e5")));
            Assert.Equal(HttpStatusCode.Forbidden, follower.StatusCode);

            var saved = await client.SendAsync(Request(HttpMethod.Post, url, seed.PlayerId, Ticket("e5")));
            Assert.Equal(HttpStatusCode.Created, saved.StatusCode);
            var ticket = await saved.Content.ReadFromJsonAsync<QuinielaTicketDto>();
            Assert.Equal("Pending", ticket!.PaymentStatus);

            var edited = await client.SendAsync(Request(HttpMethod.Put, $"{url}/{ticket.Id}", seed.PlayerId, Ticket("e5", a: "2")));
            Assert.Equal(HttpStatusCode.OK, edited.StatusCode);
            Assert.Equal(ticket.Id, (await edited.Content.ReadFromJsonAsync<QuinielaTicketDto>())!.Id);
        }

        [Fact]
        public async Task Payments_AreOnlyForTheCoach()
        {
            var (seed, baseUrl) = await SeedAsync("e6");
            var (host, client) = await StartHostAsync();
            using var _ = host;
            var jornada = await (await client.SendAsync(Request(HttpMethod.Post, baseUrl, seed.CoachId))).Content.ReadFromJsonAsync<QuinielaJornadaDto>();
            var url = $"{baseUrl}/{jornada!.Id}/payments";

            Assert.Equal(HttpStatusCode.Forbidden, (await client.SendAsync(Request(HttpMethod.Get, url, seed.PlayerId))).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(Request(HttpMethod.Get, url, seed.CoachId))).StatusCode);
        }

        [Fact]
        public async Task FullFlow_PayThenSettle_ThenSettleAgainFails()
        {
            var (seed, baseUrl) = await SeedAsync("e7");
            var (host, client) = await StartHostAsync();
            using var _ = host;
            var jornada = await (await client.SendAsync(Request(HttpMethod.Post, baseUrl, seed.CoachId))).Content.ReadFromJsonAsync<QuinielaJornadaDto>();
            var jornadaUrl = $"{baseUrl}/{jornada!.Id}";

            var ticket = await (await client.SendAsync(Request(HttpMethod.Post, $"{jornadaUrl}/my-tickets", seed.PlayerId, Ticket("e7"))))
                .Content.ReadFromJsonAsync<QuinielaTicketDto>();

            var invalidPayment = await client.SendAsync(Request(HttpMethod.Put, $"{jornadaUrl}/tickets/{ticket!.Id}/payment", seed.CoachId, new { paid = true }));
            Assert.Equal(HttpStatusCode.BadRequest, invalidPayment.StatusCode);

            var paid = await client.SendAsync(Request(HttpMethod.Put, $"{jornadaUrl}/tickets/{ticket.Id}/payment", seed.CoachId, new { paid = true, method = "Cash" }));
            Assert.Equal(HttpStatusCode.OK, paid.StatusCode);

            var unfinished = await client.SendAsync(Request(HttpMethod.Post, $"{jornadaUrl}/settle", seed.CoachId));
            Assert.Equal(HttpStatusCode.BadRequest, unfinished.StatusCode);
            Assert.Equal(ErrorCodes.QuinielaMatchesNotFinished, await ProblemCodeAsync(unfinished));

            Assert.Equal(HttpStatusCode.Forbidden, (await client.SendAsync(Request(HttpMethod.Post, $"{jornadaUrl}/settle", seed.PlayerId))).StatusCode);

            await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("e7", "1-0", "1-1", "0-1"));
            var settled = await client.SendAsync(Request(HttpMethod.Post, $"{jornadaUrl}/settle", seed.CoachId));
            Assert.Equal(HttpStatusCode.OK, settled.StatusCode);
            var settlement = await settled.Content.ReadFromJsonAsync<QuinielaSettlementDto>();
            Assert.Equal(1m, settlement!.Collected);
            Assert.Equal(0m, settlement.FundAmount);
            Assert.Equal("Special", settlement.Tickets.Single().Category);

            var again = await client.SendAsync(Request(HttpMethod.Post, $"{jornadaUrl}/settle", seed.CoachId));
            Assert.Equal(HttpStatusCode.BadRequest, again.StatusCode);
            Assert.Equal(ErrorCodes.QuinielaAlreadySettled, await ProblemCodeAsync(again));
        }
        [Fact]
        public async Task Wallet_TopUpThenSaveTicket_ChargesAndReportsItInTheResponse()
        {
            var (seed, baseUrl) = await SeedAsync("w1");
            var (host, client) = await StartHostAsync();
            using var _ = host;
            var created = await client.SendAsync(Request(HttpMethod.Post, baseUrl, seed.CoachId));
            var jornada = await created.Content.ReadFromJsonAsync<Dictionary<string, System.Text.Json.JsonElement>>();
            var jornadaId = jornada!["id"].GetString();

            var topUp = await client.SendAsync(Request(HttpMethod.Post, $"{baseUrl}/wallets/{seed.PlayerId}/top-ups", seed.CoachId, new { amount = 5, description = "Bizum" }));
            Assert.Equal(HttpStatusCode.Created, topUp.StatusCode);

            var save = await client.SendAsync(Request(HttpMethod.Post, $"{baseUrl}/{jornadaId}/my-tickets", seed.PlayerId, Ticket("w1")));
            Assert.Equal(HttpStatusCode.Created, save.StatusCode);
            var ticket = await save.Content.ReadFromJsonAsync<Dictionary<string, System.Text.Json.JsonElement>>();
            Assert.Equal("Paid", ticket!["paymentStatus"].GetString());
            Assert.Equal("Wallet", ticket["paymentMethod"].GetString());
            Assert.Equal(4m, ticket["walletCharge"].GetProperty("balanceAfter").GetDecimal());

            var wallet = await client.SendAsync(Request(HttpMethod.Get, $"{baseUrl}/wallet", seed.PlayerId));
            Assert.Equal(HttpStatusCode.OK, wallet.StatusCode);
            var body = await wallet.Content.ReadFromJsonAsync<Dictionary<string, System.Text.Json.JsonElement>>();
            Assert.Equal(4m, body!["balance"].GetDecimal());
            Assert.Equal(2, body["movements"].GetArrayLength());
        }

        [Fact]
        public async Task Wallet_ValidationAndAuthorizationErrors_AreProblemDetails()
        {
            var (seed, baseUrl) = await SeedAsync("w2");
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var tooMuch = await client.SendAsync(Request(HttpMethod.Post, $"{baseUrl}/wallets/{seed.PlayerId}/top-ups", seed.CoachId, new { amount = 10.01 }));
            Assert.Equal(HttpStatusCode.BadRequest, tooMuch.StatusCode);

            var byPlayer = await client.SendAsync(Request(HttpMethod.Post, $"{baseUrl}/wallets/{seed.PlayerId}/top-ups", seed.PlayerId, new { amount = 1 }));
            Assert.Equal(HttpStatusCode.Forbidden, byPlayer.StatusCode);

            var follower = await client.SendAsync(Request(HttpMethod.Get, $"{baseUrl}/wallet", seed.FollowerId));
            Assert.Equal(HttpStatusCode.Forbidden, follower.StatusCode);

            var adjust = await client.SendAsync(Request(HttpMethod.Post, $"{baseUrl}/wallets/{seed.PlayerId}/adjustments", seed.CoachId, new { amount = 1, reason = "motivo" }));
            Assert.Equal(HttpStatusCode.Conflict, adjust.StatusCode);
            Assert.Equal(ErrorCodes.QuinielaWalletInsufficientBalance, await ProblemCodeAsync(adjust));
        }
    }
}
