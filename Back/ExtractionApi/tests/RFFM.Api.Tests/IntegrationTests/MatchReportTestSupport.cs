#nullable enable
using System;
using System.Collections.Generic;
using System.Net.Http;
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
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services;
using RFFM.Api.Tests.Fixtures;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Host and seed helpers shared by the match-report endpoint tests (openspec match-report).
    /// Same pipeline as <see cref="LotteryEndpointTests"/>: feature permission + team membership.
    /// </summary>
    internal static class MatchReportTestSupport
    {
        public const int LeagueEventTypeId = 1;
        public const int FriendlyEventTypeId = 4;

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

        public static async Task<(IHost Host, HttpClient Client)> StartHostAsync(
            PostgresContainerFixture fixture, IFeatureModule module, Action<IServiceCollection>? configureServices = null)
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
                            services.AddHttpContextAccessor();
                            services.AddSingleton<IConfiguration>(new ConfigurationBuilder().Build());
                            services.AddScoped<ICurrentUserService, CurrentUserService>();
                            services.AddCustomProblemDetails()
                                .AddMediator(o => { o.ServiceLifetime = ServiceLifetime.Scoped; });
                            services
                                .AddTransient(typeof(IPipelineBehavior<,>), typeof(FeaturePermissionBehavior<,>))
                                .AddTransient(typeof(IPipelineBehavior<,>), typeof(TeamMembershipBehavior<,>));
                            configureServices?.Invoke(services);
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

        public static HttpRequestMessage Get(string url, string role = "Coach", string? userId = null)
        {
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("X-Test-Role", role);
            if (userId is not null)
                request.Headers.Add("X-Test-User-Id", userId);
            return request;
        }

        public static async Task EnsureConvocationsPermissionsAsync(AppDbContext db)
        {
            var seeded = new[] { ("Coach", PermissionType.ReadWrite), ("Player", PermissionType.Read), ("FamilyMember", PermissionType.Read) };
            foreach (var (role, permission) in seeded)
            {
                var exists = await db.FeaturePermissions.AnyAsync(fp => fp.FeatureRoute == CoachFeatureRoutes.Convocations && fp.RoleName == role);
                if (!exists)
                    db.FeaturePermissions.Add(new FeaturePermission("Convocations", CoachFeatureRoutes.Convocations, role, permission));
            }
            await db.SaveChangesAsync();
        }

        public static async Task<Team> SeedTeamAsync(AppDbContext db)
        {
            await EnsureConvocationsPermissionsAsync(db);

            var club = Club.Create($"MatchReport Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase { Name = "MatchReport Test Team", CategoryId = Category.NationalCategory.Id, ClubId = club.Id, SeasonId = season.Id });
            db.Teams.Add(team);
            await db.SaveChangesAsync();
            return team;
        }

        public static async Task<string> SeedPlayerAsync(AppDbContext db, Team team, string alias, int? dorsal = null)
        {
            var player = Player.Create(new PlayerModelBase { Name = alias, LastName = "Test", Alias = alias, ClubId = team.ClubId });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = team.Id,
                SeasonId = team.SeasonId,
                JoinedDate = DateTime.UtcNow,
                Dorsal = dorsal is null ? null : new DorsalModel { Number = dorsal.Value },
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();
            return teamPlayer.Id;
        }

        public static async Task<string> SeedEventAsync(
            AppDbContext db, string teamId, int eventTypeId, string? codActa = null, string? localGoals = null, string? visitorGoals = null)
        {
            var sportEvent = SportEvent.CreateNew(
                "MatchReport Test Event", DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(-1), null, null, null, null,
                eventTypeId, teamId, null, isHomeMatch: true, codActa: codActa, localGoals: localGoals, visitorGoals: visitorGoals);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();
            return sportEvent.Id;
        }

        public static async Task AddParticipationAsync(
            AppDbContext db, string eventId, string teamId, string teamPlayerId,
            int minutesPlayed = 90, bool isStarter = true, int? enteredAtMinute = 0, int? exitedAtMinute = null,
            string matchPhase = "finished", string? substitutionWindowsJson = null, string? goalsJson = null,
            string? cardsJson = null, string? startingLineupJson = null)
        {
            db.MatchParticipations.Add(MatchParticipation.Create(
                eventId, teamId, teamPlayerId, minutesPlayed, isStarter, enteredAtMinute, exitedAtMinute,
                1, 0, matchPhase, substitutionWindowsJson, null, goalsJson, cardsJson, null, startingLineupJson));
            await db.SaveChangesAsync();
        }

        public static async Task<string> AddTeamMemberAsync(AppDbContext db, string teamId, Membership membership)
        {
            var userId = $"member-{Guid.NewGuid():N}";
            db.UserTeams.Add(new UserTeam(userId, teamId, membership.Id));
            await db.SaveChangesAsync();
            return userId;
        }
    }
}
