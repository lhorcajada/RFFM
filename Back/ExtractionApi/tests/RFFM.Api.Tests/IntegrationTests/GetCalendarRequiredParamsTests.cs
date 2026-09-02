#nullable enable
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading;
using System.Threading.Tasks;
using Mediator;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendar;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendar.Responses;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendarMatchDay.Responses;
using RFFM.Api.Features.Federation.Competitions.Services;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// GET /calendar used to default competitionId/groupId to hardcoded literal RFFM ids
    /// (25255269 / 25255283) whenever a caller omitted them — e.g. CalendarService.getTeamMatches
    /// on the frontend when a saved federation combo lacked competition/group. That silently
    /// served whatever season those literal ids belonged to (a season, and sometimes a
    /// completely different team's fixtures) instead of failing loudly. Now both parameters are
    /// required.
    /// </summary>
    public class GetCalendarRequiredParamsTests
    {
        private class StubCalendarService : ICalendarService
        {
            public int? LastCompetition { get; private set; }
            public int? LastGroup { get; private set; }

            public Task<CalendarResponse> GetCalendarAsync(int competicion, int groupId, CancellationToken cancellationToken = default)
            {
                LastCompetition = competicion;
                LastGroup = groupId;
                return Task.FromResult(new CalendarResponse());
            }

            public Task<CalendarMatchDayWithRoundsResponse> GetCalendarMatchDayAsync(int groupId, int round, CancellationToken cancellationToken = default)
                => Task.FromResult(new CalendarMatchDayWithRoundsResponse());
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
                var identity = new ClaimsIdentity(new List<Claim> { new(ClaimTypes.Name, "test-user") }, SchemeName);
                var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName);
                return Task.FromResult(AuthenticateResult.Success(ticket));
            }
        }

        private static async Task<(IHost Host, HttpClient Client, StubCalendarService Stub)> StartHostAsync()
        {
            var stub = new StubCalendarService();

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
                            services.AddSingleton<ICalendarService>(stub);
                            services.AddMediator(o => { o.ServiceLifetime = ServiceLifetime.Scoped; });
                        })
                        .Configure(app =>
                        {
                            app.UseRouting();
                            app.UseAuthentication();
                            app.UseAuthorization();
                            app.UseEndpoints(endpoints => new FederationGetCalendar().AddRoutes(endpoints));
                        });
                })
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient(), stub);
        }

        [Fact]
        public async Task GetCalendar_WithoutCompetitionAndGroup_ReturnsBadRequest()
        {
            var (host, client, _) = await StartHostAsync();
            using var _disposeHost = host;

            var response = await client.GetAsync("/calendar");

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task GetCalendar_WithExplicitCompetitionAndGroup_ForwardsThemUnchanged()
        {
            var (host, client, stub) = await StartHostAsync();
            using var _disposeHost = host;

            var response = await client.GetAsync("/calendar?competitionId=111&groupId=222");

            response.EnsureSuccessStatusCode();
            Assert.Equal(111, stub.LastCompetition);
            Assert.Equal(222, stub.LastGroup);
        }
    }
}
