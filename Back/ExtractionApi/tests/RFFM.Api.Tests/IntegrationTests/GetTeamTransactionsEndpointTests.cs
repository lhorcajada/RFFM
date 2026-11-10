#nullable enable
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
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
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Teams.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services;
using RFFM.Api.Tests.Fixtures;
using RFFM.Api.Tests.UnitTests;
using Xunit;
using static RFFM.Api.Tests.UnitTests.QuinielaTestSupport;
using TeamTransactionDto = RFFM.Api.Features.Coaches.Teams.Queries.GetTeamTransactions.TeamTransactionDto;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// GET /api/catalog/team/{teamId}/transactions over the real HTTP pipeline: query parsing (400 ProblemDetails
    /// before the query runs), anonymous rejection (401), team membership (403 ProblemDetails) and the list shape.
    /// Behavior that the handler tests cannot observe. See openspec/changes/team-transactions-window/specs/team-transactions-list/spec.md.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class GetTeamTransactionsEndpointTests(PostgresContainerFixture fixture)
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
                            services.AddDbContext<IdentityDbContext>(options =>
                                options.UseNpgsql(fixture.ConnectionString, npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "identity")));
                            services.AddDbContext<FederationDbContext>(options =>
                                options.UseNpgsql(fixture.ConnectionString, npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "federation")));
                            services.AddHttpContextAccessor();
                            services.AddSingleton<IConfiguration>(new ConfigurationBuilder().Build());
                            services.AddScoped<ICurrentUserService, CurrentUserService>();
                            services.AddCustomProblemDetails()
                                .AddMediator(o => { o.ServiceLifetime = ServiceLifetime.Scoped; });
                            services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
                        })
                        .Configure(app =>
                        {
                            app.UseProblemDetails();
                            app.UseRouting();
                            app.UseAuthentication();
                            app.UseAuthorization();
                            app.UseEndpoints(endpoints => new GetTeamTransactions().AddRoutes(endpoints));
                        });
                })
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient());
        }

        private static HttpRequestMessage Request(string url, string? userId)
        {
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            if (userId is null)
                request.Headers.Add("X-Test-Anonymous", "1");
            else
                request.Headers.Add("X-Test-User-Id", userId);
            return request;
        }

        private async Task<QuinielaSeed> SeedWithPendingSanctionAsync()
        {
            var seed = await SeedTeamAsync(fixture);
            await using var db = fixture.CreateDbContext();
            var teamPlayerId = await SeedTeamPlayerAsync(db, seed, "Ana", "Lopez");
            db.TeamPlayerSanctions.Add(TeamPlayerSanction.Create(teamPlayerId.ToString(), SanctionCategory.Competition,
                new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc), "Expulsión", null, null, fine: 100m));
            await db.SaveChangesAsync();
            return seed;
        }

        [Theory]
        [InlineData("status=Expired")]
        [InlineData("type=Unknown")]
        [InlineData("status=1")]
        [InlineData("type=2")]
        public async Task Get_WithUnknownFilterValue_ReturnsBadRequestProblemDetails(string filter)
        {
            var seed = await SeedTeamAsync(fixture);
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var response = await client.SendAsync(Request($"/api/catalog/team/{seed.TeamId}/transactions?{filter}", seed.CoachId));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        }

        [Fact]
        public async Task Get_FilterByStatus_ReturnsOnlyTheFilteredTransactions()
        {
            var seed = await SeedWithPendingSanctionAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var response = await client.SendAsync(Request($"/api/catalog/team/{seed.TeamId}/transactions?status=Pending", seed.CoachId));

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<TeamTransactionDto[]>();
            Assert.NotNull(body);
            Assert.NotEmpty(body!);
            Assert.All(body!, row => Assert.Equal("Pending", row.Status));
        }

        [Fact]
        public async Task Get_FilterByTypeInAnyCase_ReturnsOnlyTheFilteredTransactions()
        {
            var seed = await SeedWithPendingSanctionAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var response = await client.SendAsync(Request($"/api/catalog/team/{seed.TeamId}/transactions?type=sanction", seed.CoachId));

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<TeamTransactionDto[]>();
            Assert.NotNull(body);
            Assert.NotEmpty(body!);
            Assert.All(body!, row => Assert.Equal("Sanction", row.Type));
        }

        [Fact]
        public async Task Get_WithoutCredentials_ReturnsUnauthorized()
        {
            var seed = await SeedWithPendingSanctionAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var response = await client.SendAsync(Request($"/api/catalog/team/{seed.TeamId}/transactions", null));

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Get_UserOfAnotherTeam_ReturnsForbiddenProblemDetailsWithoutTransactions()
        {
            var seed = await SeedWithPendingSanctionAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var response = await client.SendAsync(Request($"/api/catalog/team/{seed.TeamId}/transactions", seed.OutsiderId));

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(JsonValueKind.Object, body.ValueKind);
            Assert.Equal(403, body.GetProperty("status").GetInt32());
        }

        private sealed record RowIds(List<string> Sanctions, List<string> Books, List<string> Tickets, List<string> Movements);

        private async Task<RowIds> SnapshotRowsAsync(string teamId)
        {
            await using var db = fixture.CreateDbContext();
            var sanctions = await db.TeamPlayerSanctions.Where(s => s.TeamPlayer.TeamId == teamId).Select(s => s.Id).ToListAsync();
            var books = await db.LotteryBooks
                .Where(b => db.LotteryCampaigns.Any(c => c.Id == b.LotteryCampaignId && c.TeamId == teamId))
                .Select(b => b.Id).ToListAsync();
            var tickets = await db.QuinielaTickets
                .Where(t => db.QuinielaJornadas.Any(j => j.Id == t.JornadaId && j.TeamId == teamId))
                .Select(t => t.Id).ToListAsync();
            var movements = await db.QuinielaWalletMovements
                .Where(m => db.QuinielaWallets.Any(w => w.Id == m.WalletId && w.TeamId == teamId))
                .Select(m => m.Id).ToListAsync();
            return new RowIds(sanctions.Order().ToList(), books.Order().ToList(), tickets.Order().ToList(), movements.Order().ToList());
        }

        private async Task<QuinielaSeed> SeedAllSourcesAsync()
        {
            var seed = await SeedTeamAsync(fixture);
            var suffix = Guid.NewGuid().ToString("N")[..8];
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches(suffix));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);

            await using var db = fixture.CreateDbContext();
            var teamPlayerId = await SeedTeamPlayerAsync(db, seed, "Ana", "Lopez");
            db.TeamPlayerSanctions.Add(TeamPlayerSanction.Create(teamPlayerId.ToString(), SanctionCategory.Competition,
                new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc), "Expulsión", null, null, fine: 100m));

            var campaign = LotteryCampaign.Create(seed.TeamId, "Lotería", new DateOnly(2026, 12, 20), 2m, 10,
                new DateOnly(2026, 10, 1), new DateOnly(2026, 12, 1));
            campaign.DeliverBook(teamPlayerId.ToString(), 1, 1, new DateOnly(2026, 2, 20));
            db.LotteryCampaigns.Add(campaign);

            var ticket = QuinielaTicket.Create(jornada.Id, seed.PlayerId,
                [new($"A{suffix}", QuinielaSign.Home), new($"B{suffix}", QuinielaSign.Draw), new($"C{suffix}", QuinielaSign.Away)], 0, 1);
            db.QuinielaTickets.Add(ticket);

            var wallet = QuinielaWallet.Create(seed.TeamId, seed.PlayerId);
            db.QuinielaWallets.Add(wallet);
            db.QuinielaWalletMovements.Add(wallet.TopUp(5m, seed.PlayerId, "Recarga", new DateTime(2026, 3, 3, 0, 0, 0, DateTimeKind.Utc)));
            await db.SaveChangesAsync();

            return seed;
        }

        [Fact]
        public async Task Get_CalledTwice_LeavesSeededRowsUnchanged()
        {
            var seed = await SeedAllSourcesAsync();
            var before = await SnapshotRowsAsync(seed.TeamId);
            Assert.Single(before.Sanctions);
            Assert.Single(before.Books);
            Assert.Single(before.Tickets);
            Assert.Single(before.Movements);
            var (host, client) = await StartHostAsync();
            using var _ = host;
            var url = $"/api/catalog/team/{seed.TeamId}/transactions";

            var first = await client.SendAsync(Request(url, seed.CoachId));
            var second = await client.SendAsync(Request(url, seed.CoachId));

            Assert.Equal(HttpStatusCode.OK, first.StatusCode);
            Assert.Equal(HttpStatusCode.OK, second.StatusCode);
            var after = await SnapshotRowsAsync(seed.TeamId);
            Assert.Equal(before.Sanctions, after.Sanctions);
            Assert.Equal(before.Books, after.Books);
            Assert.Equal(before.Tickets, after.Tickets);
            Assert.Equal(before.Movements, after.Movements);
        }

        [Fact]
        public async Task Get_TeamWithoutTransactions_ReturnsOkWithEmptyJsonArray()
        {
            var seed = await SeedTeamAsync(fixture);
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var response = await client.SendAsync(Request($"/api/catalog/team/{seed.TeamId}/transactions", seed.CoachId));

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(JsonValueKind.Array, body.ValueKind);
            Assert.Equal(0, body.GetArrayLength());
        }
    }
}
