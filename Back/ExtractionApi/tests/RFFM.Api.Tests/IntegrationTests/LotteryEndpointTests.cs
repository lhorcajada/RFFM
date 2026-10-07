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
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Lottery;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Endpoints de lotería con el pipeline real (validación, permiso de feature y pertenencia al equipo).
    /// See openspec/changes/team-lottery/design.md → D3.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class LotteryEndpointTests
    {
        private readonly PostgresContainerFixture _fixture;

        public LotteryEndpointTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
        {
            public const string SchemeName = "Test";

            public TestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
                : base(options, logger, encoder)
            {
            }

            protected override Task<AuthenticateResult> HandleAuthenticateAsync()
            {
                var role = Request.Headers.TryGetValue("X-Test-Role", out var roleValues) ? roleValues.ToString() : string.Empty;
                var userId = Request.Headers.TryGetValue("X-Test-User-Id", out var userValues) ? userValues.ToString() : "test-user";
                var claims = new List<Claim> { new(ClaimTypes.Name, "test-user"), new(ClaimTypes.NameIdentifier, userId) };
                if (!string.IsNullOrEmpty(role))
                    claims.Add(new Claim(ClaimTypes.Role, role));

                var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, SchemeName));
                return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, SchemeName)));
            }
        }

        private static readonly IFeatureModule[] Modules =
        {
            new GetLotteryCampaigns(), new GetLotteryCampaign(), new CreateLotteryCampaign(), new UpdateLotteryCampaign(),
            new DeleteLotteryCampaign(), new DeliverLotteryBook(), new UpdateLotteryBook(), new DeleteLotteryBook(),
            new ReturnLotteryBook(), new UndoLotteryBookReturn(), new RecordLotteryClubDelivery(), new UndoLotteryClubDelivery()
        };

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
                                options.UseNpgsql(_fixture.ConnectionString, npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "app")));
                            services.AddHttpContextAccessor();
                            services.AddSingleton<IConfiguration>(new ConfigurationBuilder().Build());
                            services.AddScoped<ICurrentUserService, CurrentUserService>();
                            services.AddCustomProblemDetails()
                                .AddMediator(o => { o.ServiceLifetime = ServiceLifetime.Scoped; });
                            services
                                .AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>))
                                .AddTransient(typeof(IPipelineBehavior<,>), typeof(FeaturePermissionBehavior<,>))
                                .AddTransient(typeof(IPipelineBehavior<,>), typeof(TeamMembershipBehavior<,>));
                            services.AddLotteryValidators();
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

        private sealed record Seed(string TeamId, string PlayerOneId, string PlayerTwoId, string PlayerUserId);

        private async Task<Seed> SeedAsync()
        {
            await using var db = _fixture.CreateDbContext();
            await EnsureLotteryPermissionsAsync(db);
            var (teamId, playerOneId, _) = await PlayerModelObservationPersistenceTests.SeedAsync(db);
            var team = await db.Teams.SingleAsync(t => t.Id == teamId);

            var player = Player.Create(new PlayerModelBase { Name = "Hugo", LastName = "Martín", Alias = $"lot-{Guid.NewGuid():N}", ClubId = team.ClubId });
            db.Players.Add(player);
            await db.SaveChangesAsync();
            var playerTwo = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = teamId,
                SeasonId = team.SeasonId,
                JoinedDate = DateTime.UtcNow.AddDays(-100),
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(playerTwo);

            var playerUserId = $"player-user-{Guid.NewGuid():N}";
            var userTeam = new UserTeam(playerUserId, teamId, Membership.Player.Id);
            userTeam.LinkPlayer(playerOneId);
            db.UserTeams.Add(userTeam);
            await db.SaveChangesAsync();

            return new Seed(teamId, playerOneId, playerTwo.Id, playerUserId);
        }

        private static async Task EnsureLotteryPermissionsAsync(AppDbContext db)
        {
            var seeded = new[] { ("Coach", PermissionType.ReadWrite), ("Player", PermissionType.Read), ("FamilyMember", PermissionType.Read) };
            foreach (var (role, permission) in seeded)
            {
                var exists = await db.FeaturePermissions.AnyAsync(fp => fp.FeatureRoute == CoachFeatureRoutes.Lottery && fp.RoleName == role);
                if (!exists)
                    db.FeaturePermissions.Add(new FeaturePermission("Lottery", CoachFeatureRoutes.Lottery, role, permission));
            }
            await db.SaveChangesAsync();
        }

        private static HttpRequestMessage Request(HttpMethod method, string url, object? body = null, string role = "Coach", string? userId = null)
        {
            var request = new HttpRequestMessage(method, url);
            if (body is not null)
                request.Content = JsonContent.Create(body);
            request.Headers.Add("X-Test-Role", role);
            if (userId is not null)
                request.Headers.Add("X-Test-User-Id", userId);
            return request;
        }

        private static object NewCampaign() => new
        {
            name = "Lotería de Navidad 2026",
            drawDate = "2026-12-22",
            ticketPrice = 5m,
            ticketsPerBook = 15,
            clubDeliveryFrom = "2026-12-09",
            clubDeliveryTo = "2026-12-15"
        };

        private static async Task<LotteryCampaignDto> ReadCampaignAsync(HttpResponseMessage response, HttpStatusCode expected = HttpStatusCode.OK)
        {
            Assert.True(response.StatusCode == expected, $"{response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
            return (await response.Content.ReadFromJsonAsync<LotteryCampaignDto>())!;
        }

        private static async Task<string> ProblemCodeAsync(HttpResponseMessage response)
        {
            var problem = await response.Content.ReadFromJsonAsync<Dictionary<string, object>>();
            return problem!["code"].ToString()!;
        }

        private async Task<(Seed Seed, HttpClient Client, IHost Host, LotteryCampaignDto Campaign)> CreateCampaignAsync()
        {
            var seed = await SeedAsync();
            var (host, client) = await StartHostAsync();
            var campaign = await ReadCampaignAsync(
                await client.SendAsync(Request(HttpMethod.Post, $"/api/teams/{seed.TeamId}/lottery-campaigns", NewCampaign())),
                HttpStatusCode.Created);
            return (seed, client, host, campaign);
        }

        [Fact]
        public async Task FullFlow_ComputesTotals()
        {
            var (seed, client, host, campaign) = await CreateCampaignAsync();
            using var _ = host;
            var baseUrl = $"/api/teams/{seed.TeamId}/lottery-campaigns/{campaign.Id}";

            Assert.Empty(campaign.Books);
            Assert.Equal(0, campaign.Totals.BooksDelivered);
            Assert.True(campaign.CanEdit);

            await client.SendAsync(Request(HttpMethod.Post, $"{baseUrl}/books", new { teamPlayerId = seed.PlayerOneId, bookNumber = 1, firstTicketNumber = 1 }));
            await client.SendAsync(Request(HttpMethod.Post, $"{baseUrl}/books", new { teamPlayerId = seed.PlayerOneId, bookNumber = 2, firstTicketNumber = 16 }));
            var delivered = await ReadCampaignAsync(
                await client.SendAsync(Request(HttpMethod.Post, $"{baseUrl}/books", new { teamPlayerId = seed.PlayerTwoId, bookNumber = 3, firstTicketNumber = 31, deliveredOn = "2026-11-20" })),
                HttpStatusCode.Created);

            var third = delivered.Books.Single(b => b.BookNumber == 3);
            Assert.Equal(45, third.LastTicketNumber);
            Assert.Equal(new DateOnly(2026, 11, 20), third.DeliveredOn);
            var first = delivered.Books.Single(b => b.BookNumber == 1);
            Assert.Equal(DateOnly.FromDateTime(DateTime.UtcNow), first.DeliveredOn);

            await client.SendAsync(Request(HttpMethod.Put, $"{baseUrl}/books/{first.Id}/return", new { amount = 75m }));
            var returned = await ReadCampaignAsync(await client.SendAsync(
                Request(HttpMethod.Put, $"{baseUrl}/books/{third.Id}/return", new { amount = 40m, returnedOn = "2026-12-01" })));

            var totals = returned.Totals;
            Assert.Equal(3, totals.BooksDelivered);
            Assert.Equal(2, totals.BooksReturned);
            Assert.Equal(1, totals.BooksPending);
            Assert.Equal(45, totals.TicketsDelivered);
            Assert.Equal(23, totals.TicketsSold);
            Assert.Equal(7, totals.TicketsUnsold);
            Assert.Equal(15, totals.TicketsPending);
            Assert.Equal(115m, totals.AmountCollected);
            Assert.Equal(75m, totals.AmountPending);
            var thirdReturned = returned.Books.Single(b => b.Id == third.Id);
            Assert.Equal(8, thirdReturned.TicketsSold);
            Assert.Equal(7, thirdReturned.TicketsUnsold);

            var settled = await ReadCampaignAsync(await client.SendAsync(
                Request(HttpMethod.Put, $"{baseUrl}/club-delivery", new { amount = 115m, deliveredOn = "2026-12-10" })));
            Assert.Equal(new DateOnly(2026, 12, 10), settled.ClubDeliveredOn);
            Assert.Equal(115m, settled.ClubDeliveredAmount);
        }

        [Fact]
        public async Task UndoReturn_AndDeleteBook_Work()
        {
            var (seed, client, host, campaign) = await CreateCampaignAsync();
            using var _ = host;
            var baseUrl = $"/api/teams/{seed.TeamId}/lottery-campaigns/{campaign.Id}";
            var delivered = await ReadCampaignAsync(await client.SendAsync(
                Request(HttpMethod.Post, $"{baseUrl}/books", new { teamPlayerId = seed.PlayerOneId, bookNumber = 1, firstTicketNumber = 1 })),
                HttpStatusCode.Created);
            var bookId = delivered.Books.Single().Id;
            await client.SendAsync(Request(HttpMethod.Put, $"{baseUrl}/books/{bookId}/return", new { amount = 75m }));

            var deleteReturned = await client.SendAsync(Request(HttpMethod.Delete, $"{baseUrl}/books/{bookId}"));
            Assert.Equal(HttpStatusCode.BadRequest, deleteReturned.StatusCode);
            Assert.Equal(ErrorCodes.LotteryBookAlreadyReturned, await ProblemCodeAsync(deleteReturned));

            var undone = await ReadCampaignAsync(await client.SendAsync(Request(HttpMethod.Delete, $"{baseUrl}/books/{bookId}/return")));
            Assert.Null(undone.Books.Single().AmountReturned);

            var removed = await ReadCampaignAsync(await client.SendAsync(Request(HttpMethod.Delete, $"{baseUrl}/books/{bookId}")));
            Assert.Empty(removed.Books);
        }

        [Fact]
        public async Task UpdateCampaign_ClubWindowWithBooks_IsAllowed()
        {
            var (seed, client, host, campaign) = await CreateCampaignAsync();
            using var _ = host;
            var baseUrl = $"/api/teams/{seed.TeamId}/lottery-campaigns/{campaign.Id}";
            await client.SendAsync(Request(HttpMethod.Post, $"{baseUrl}/books", new { teamPlayerId = seed.PlayerOneId, bookNumber = 1, firstTicketNumber = 1 }));

            var updated = await ReadCampaignAsync(await client.SendAsync(Request(HttpMethod.Put, baseUrl, new
            {
                name = "Lotería de Navidad 2026",
                drawDate = "2026-12-22",
                ticketPrice = 5m,
                ticketsPerBook = 15,
                clubDeliveryFrom = "2026-12-12",
                clubDeliveryTo = "2026-12-19"
            })));

            Assert.Equal(new DateOnly(2026, 12, 12), updated.ClubDeliveryFrom);
            Assert.Equal(new DateOnly(2026, 12, 19), updated.ClubDeliveryTo);
            Assert.Single(updated.Books);
        }

        [Fact]
        public async Task ListAndDeleteCampaign_Work()
        {
            var (seed, client, host, campaign) = await CreateCampaignAsync();
            using var _ = host;

            var list = await client.SendAsync(Request(HttpMethod.Get, $"/api/teams/{seed.TeamId}/lottery-campaigns"));
            var summaries = await list.Content.ReadFromJsonAsync<List<LotteryCampaignSummaryDto>>();
            var summary = Assert.Single(summaries!);
            Assert.Equal(campaign.Id, summary.Id);

            var deleted = await client.SendAsync(Request(HttpMethod.Delete, $"/api/teams/{seed.TeamId}/lottery-campaigns/{campaign.Id}"));
            Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);

            var missing = await client.SendAsync(Request(HttpMethod.Get, $"/api/teams/{seed.TeamId}/lottery-campaigns/{campaign.Id}"));
            Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        }

        [Fact]
        public async Task DeliverBook_ToPlayerOfAnotherTeam_ReturnsNotFound()
        {
            var (seed, client, host, campaign) = await CreateCampaignAsync();
            using var _ = host;
            await using var db = _fixture.CreateDbContext();
            var (_, foreignPlayerId, _) = await PlayerModelObservationPersistenceTests.SeedAsync(db);

            var response = await client.SendAsync(Request(HttpMethod.Post,
                $"/api/teams/{seed.TeamId}/lottery-campaigns/{campaign.Id}/books",
                new { teamPlayerId = foreignPlayerId, bookNumber = 1, firstTicketNumber = 1 }));

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal(ErrorCodes.TeamPlayerNotFound, await ProblemCodeAsync(response));
        }

        [Fact]
        public async Task Campaign_OfAnotherTeam_ReturnsNotFound()
        {
            var (_, client, host, campaign) = await CreateCampaignAsync();
            using var _ = host;
            var other = await SeedAsync();

            var response = await client.SendAsync(Request(HttpMethod.Get, $"/api/teams/{other.TeamId}/lottery-campaigns/{campaign.Id}"));

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task ReturnBook_WithInvalidAmount_ReturnsBadRequest()
        {
            var (seed, client, host, campaign) = await CreateCampaignAsync();
            using var _ = host;
            var baseUrl = $"/api/teams/{seed.TeamId}/lottery-campaigns/{campaign.Id}";
            var delivered = await ReadCampaignAsync(await client.SendAsync(
                Request(HttpMethod.Post, $"{baseUrl}/books", new { teamPlayerId = seed.PlayerOneId, bookNumber = 1, firstTicketNumber = 1 })),
                HttpStatusCode.Created);

            var response = await client.SendAsync(Request(HttpMethod.Put, $"{baseUrl}/books/{delivered.Books.Single().Id}/return", new { amount = 62m }));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal(ErrorCodes.LotteryInvalidReturnAmount, await ProblemCodeAsync(response));
        }

        [Fact]
        public async Task CreateCampaign_WithoutName_ReturnsValidationProblem()
        {
            var seed = await SeedAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var response = await client.SendAsync(Request(HttpMethod.Post, $"/api/teams/{seed.TeamId}/lottery-campaigns", new
            {
                name = "",
                drawDate = "2026-12-22",
                ticketPrice = 5m,
                ticketsPerBook = 15,
                clubDeliveryFrom = "2026-12-09",
                clubDeliveryTo = "2026-12-15"
            }));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Player_SeesOnlyOwnBooks_AndCannotEdit()
        {
            var (seed, client, host, campaign) = await CreateCampaignAsync();
            using var _ = host;
            var baseUrl = $"/api/teams/{seed.TeamId}/lottery-campaigns/{campaign.Id}";
            await client.SendAsync(Request(HttpMethod.Post, $"{baseUrl}/books", new { teamPlayerId = seed.PlayerOneId, bookNumber = 1, firstTicketNumber = 1 }));
            await client.SendAsync(Request(HttpMethod.Post, $"{baseUrl}/books", new { teamPlayerId = seed.PlayerTwoId, bookNumber = 2, firstTicketNumber = 16 }));

            var asPlayer = await ReadCampaignAsync(await client.SendAsync(
                Request(HttpMethod.Get, baseUrl, role: "Player", userId: seed.PlayerUserId)));

            var book = Assert.Single(asPlayer.Books);
            Assert.Equal(seed.PlayerOneId, book.TeamPlayerId);
            Assert.Equal(1, asPlayer.Totals.BooksDelivered);
            Assert.False(asPlayer.CanEdit);
        }

        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task Writes_WithReadOnlyRole_ReturnForbidden(string role)
        {
            var (seed, client, host, campaign) = await CreateCampaignAsync();
            using var _ = host;
            var baseUrl = $"/api/teams/{seed.TeamId}/lottery-campaigns/{campaign.Id}";

            var requests = new[]
            {
                Request(HttpMethod.Post, $"/api/teams/{seed.TeamId}/lottery-campaigns", NewCampaign(), role, seed.PlayerUserId),
                Request(HttpMethod.Put, baseUrl, NewCampaign(), role, seed.PlayerUserId),
                Request(HttpMethod.Delete, baseUrl, role: role, userId: seed.PlayerUserId),
                Request(HttpMethod.Post, $"{baseUrl}/books", new { teamPlayerId = seed.PlayerOneId, bookNumber = 1, firstTicketNumber = 1 }, role, seed.PlayerUserId),
                Request(HttpMethod.Put, $"{baseUrl}/club-delivery", new { amount = 10m }, role, seed.PlayerUserId),
                Request(HttpMethod.Delete, $"{baseUrl}/club-delivery", role: role, userId: seed.PlayerUserId)
            };

            foreach (var request in requests)
            {
                var response = await client.SendAsync(request);
                Assert.True(response.StatusCode == HttpStatusCode.Forbidden, $"{request.Method} {request.RequestUri}: {response.StatusCode}");
            }
        }

        [Fact]
        public async Task Player_OfAnotherTeam_IsForbidden()
        {
            var (_, client, host, campaign) = await CreateCampaignAsync();
            using var _ = host;
            var other = await SeedAsync();

            var response = await client.SendAsync(Request(HttpMethod.Get,
                $"/api/teams/{campaign.TeamId}/lottery-campaigns/{campaign.Id}", role: "Player", userId: other.PlayerUserId));

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }
    }
}
