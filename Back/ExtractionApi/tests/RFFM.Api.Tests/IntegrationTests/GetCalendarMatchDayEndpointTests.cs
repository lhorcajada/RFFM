#nullable enable
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
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
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendar.Responses;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendarMatchDay;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendarMatchDay.Responses;
using RFFM.Api.Features.Federation.MatchResults.Services;
using RFFM.Api.Infrastructure.Options;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    public class GetCalendarMatchDayEndpointTests
    {
        private sealed class StubSyncService : IRffmResultsSyncService
        {
            public (int GroupId, int Round, int Season)? LastCall { get; private set; }

            public Task<CalendarMatchDayWithRoundsResponse> GetMatchDayAsync(int groupId, int round, int seasonId,
                CancellationToken cancellationToken)
            {
                LastCall = (groupId, round, seasonId);
                return Task.FromResult(new CalendarMatchDayWithRoundsResponse
                {
                    Round = round,
                    GroupId = groupId,
                    CompetitionName = "SUPERLIGA CADETE",
                    MatchDay = new CalendarMatchDayResponse
                    {
                        MatchDayNumber = round,
                        Matches = [new MatchResponse { MatchRecordCode = "5572725", LocalGoals = "1" }]
                    }
                });
            }
        }

        private sealed class TestAuthHandler(
            IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
            : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
        {
            public const string SchemeName = "Test";

            protected override Task<AuthenticateResult> HandleAuthenticateAsync()
            {
                var identity = new ClaimsIdentity(new List<Claim> { new(ClaimTypes.Name, "test-user") }, SchemeName);
                return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
            }
        }

        private static async Task<(IHost Host, HttpClient Client, StubSyncService Stub)> StartHostAsync()
        {
            var stub = new StubSyncService();
            var host = new HostBuilder()
                .ConfigureWebHost(webBuilder => webBuilder
                    .UseTestServer()
                    .ConfigureServices(services =>
                    {
                        services.AddRouting();
                        services.AddAuthentication(TestAuthHandler.SchemeName)
                            .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
                        services.AddAuthorization();
                        services.AddSingleton<IRffmResultsSyncService>(stub);
                        services.Configure<RffmOptions>(o => o.CurrentSeasonId = 22);
                        services.AddMediator(o => { o.ServiceLifetime = ServiceLifetime.Scoped; });
                    })
                    .Configure(app =>
                    {
                        app.UseRouting();
                        app.UseAuthentication();
                        app.UseAuthorization();
                        app.UseEndpoints(endpoints => new FederationGetCalendarMatchDay().AddRoutes(endpoints));
                    }))
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient(), stub);
        }

        [Fact]
        public async Task Devuelve_la_jornada_del_servicio_de_resultados_con_la_temporada_indicada()
        {
            var (host, client, stub) = await StartHostAsync();
            using var _ = host;

            var response = await client.GetFromJsonAsync<CalendarMatchDayWithRoundsResponse>(
                "/calendar/matchday?groupId=26738048&round=3&season=21");

            Assert.Equal((26738048, 3, 21), stub.LastCall);
            Assert.Equal("5572725", Assert.Single(response!.MatchDay.Matches).MatchRecordCode);
        }

        [Fact]
        public async Task Sin_temporada_usa_la_temporada_actual_configurada()
        {
            var (host, client, stub) = await StartHostAsync();
            using var _ = host;

            var response = await client.GetAsync("/calendar/matchday?groupId=26738048&round=1");

            response.EnsureSuccessStatusCode();
            Assert.Equal(22, stub.LastCall!.Value.Season);
        }

        [Fact]
        public async Task Una_jornada_menor_o_igual_que_cero_devuelve_400()
        {
            var (host, client, stub) = await StartHostAsync();
            using var _ = host;

            var response = await client.GetAsync("/calendar/matchday?groupId=26738048&round=0");

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Null(stub.LastCall);
        }
    }
}
