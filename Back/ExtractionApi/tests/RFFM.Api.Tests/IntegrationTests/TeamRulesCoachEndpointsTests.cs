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
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.DependencyInjection;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Teams.Commands;
using RFFM.Api.Features.Mobile.Teams.Commands;
using RFFM.Api.Features.Mobile.Teams.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services;
using RFFM.Api.Infrastructure.Storage;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Proves the Coach-namespace routes (api/coaches/teams/{teamId}/rules) delegate to the exact
    /// same Mediator command/query types as the Mobile namespace — not a re-test of the underlying
    /// handlers' business logic (already covered by GetTeamRulesHandlerTests/
    /// SaveTeamRulesHandlerTests/DeleteTeamRulesHandlerTests).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class TeamRulesCoachEndpointsTests
    {
        private readonly PostgresContainerFixture _fixture;

        public TeamRulesCoachEndpointsTests(PostgresContainerFixture fixture)
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
                var claims = new List<Claim>
                {
                    new(ClaimTypes.Name, "test-user"),
                    new(ClaimTypes.Role, "Administrator")
                };
                var identity = new ClaimsIdentity(claims, SchemeName);
                var principal = new ClaimsPrincipal(identity);
                var ticket = new AuthenticationTicket(principal, SchemeName);
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

                            services.AddScoped<IValidator<SaveTeamRules.SaveTeamRulesCommand>, SaveTeamRules.Validator>();
                        })
                        .Configure(app =>
                        {
                            app.UseProblemDetails();
                            app.UseRouting();
                            app.UseAuthentication();
                            app.UseAuthorization();
                            app.UseEndpoints(endpoints => new TeamRulesCoachEndpoints().AddRoutes(endpoints));
                        });
                })
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient());
        }

        private async Task<string> SeedTeamAsync()
        {
            await using var db = _fixture.CreateDbContext();

            var club = Club.Create($"Coach Rules Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Coach Rules Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return team.Id;
        }

        [Fact]
        public async Task Get_NoRulesSet_ReturnsNoContent()
        {
            var teamId = await SeedTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/coaches/teams/{teamId}/rules");
            request.Headers.Add("X-Test-Role", "Administrator");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        }

        [Fact]
        public async Task Put_ValidCommand_CreatesRulesSetAndGetReturnsIt()
        {
            var teamId = await SeedTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var putRequest = new HttpRequestMessage(HttpMethod.Put, $"/api/coaches/teams/{teamId}/rules")
            {
                Content = JsonContent.Create(new SaveTeamRules.SaveTeamRulesCommand
                {
                    Title = "Titulo",
                    Subtitle = "Subtitulo",
                    IntroNote = "Nota inicial",
                    Rules = new List<SaveTeamRules.SaveTeamRuleRequest>
                    {
                        new() { ShortTitle = "Regla", ViolationSummary = "Violacion", ConsequenceSummary = "Consecuencia" }
                    }
                })
            };

            var putResponse = await client.SendAsync(putRequest);
            Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);

            var getRequest = new HttpRequestMessage(HttpMethod.Get, $"/api/coaches/teams/{teamId}/rules");
            var getResponse = await client.SendAsync(getRequest);

            Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
            var dto = await getResponse.Content.ReadFromJsonAsync<GetTeamRules.TeamRulesDto>();
            Assert.NotNull(dto);
            Assert.Equal("Titulo", dto!.Title);
            Assert.Single(dto.Rules);
        }

        [Fact]
        public async Task Delete_ExistingRulesSet_RemovesItAndGetReturnsNoContentAfterward()
        {
            var teamId = await SeedTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var putRequest = new HttpRequestMessage(HttpMethod.Put, $"/api/coaches/teams/{teamId}/rules")
            {
                Content = JsonContent.Create(new SaveTeamRules.SaveTeamRulesCommand
                {
                    Title = "Titulo",
                    Subtitle = "Subtitulo",
                    IntroNote = "Nota inicial",
                    Rules = new List<SaveTeamRules.SaveTeamRuleRequest>
                    {
                        new() { ShortTitle = "Regla", ViolationSummary = "Violacion", ConsequenceSummary = "Consecuencia" }
                    }
                })
            };
            await client.SendAsync(putRequest);

            var deleteResponse = await client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, $"/api/coaches/teams/{teamId}/rules"));
            Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

            var getResponse = await client.SendAsync(new HttpRequestMessage(HttpMethod.Get, $"/api/coaches/teams/{teamId}/rules"));
            Assert.Equal(HttpStatusCode.NoContent, getResponse.StatusCode);
        }
    }
}
