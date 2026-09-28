#nullable enable
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Mediator;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain.Entities.Federation.SquadHistory;
using RFFM.Api.Features.Federation.SquadHistory;
using RFFM.Api.Features.Federation.SquadHistory.Services;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class SquadHistoryEndpointTests
    {
        private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };
        private readonly PostgresContainerFixture _fixture;

        public SquadHistoryEndpointTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
        {
            public const string SchemeName = "Test";

            public TestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
                : base(options, logger, encoder)
            {
            }

            protected override Task<AuthenticateResult> HandleAuthenticateAsync()
            {
                if (!Request.Headers.TryGetValue("X-Test-User", out var user))
                    return Task.FromResult(AuthenticateResult.NoResult());

                var identity = new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, user.ToString()) }, SchemeName);
                return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
            }
        }

        private sealed class RecordingQueue : ISquadHistoryQueue
        {
            public ConcurrentQueue<string> Enqueued { get; } = new();

            public ValueTask EnqueueAsync(string reportId, CancellationToken cancellationToken = default)
            {
                Enqueued.Enqueue(reportId);
                return ValueTask.CompletedTask;
            }

            public async IAsyncEnumerable<string> DequeueAllAsync([System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
            {
                await Task.CompletedTask;
                yield break;
            }
        }

        private async Task<(IHost Host, HttpClient Client, RecordingQueue Queue)> StartHostAsync()
        {
            var queue = new RecordingQueue();
            var host = new HostBuilder()
                .ConfigureWebHost(web => web
                    .UseTestServer()
                    .ConfigureServices(services =>
                    {
                        services.AddRouting();
                        services.AddAuthentication(TestAuthHandler.SchemeName)
                            .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
                        services.AddAuthorization();
                        services.AddDbContext<FederationDbContext>(o => o.UseNpgsql(_fixture.ConnectionString,
                            npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "federation")));
                        services.AddMediator(o => { o.ServiceLifetime = ServiceLifetime.Scoped; });
                        services.AddSingleton<ISquadHistoryQueue>(queue);
                    })
                    .Configure(app =>
                    {
                        app.UseRouting();
                        app.UseAuthentication();
                        app.UseAuthorization();
                        app.UseEndpoints(endpoints =>
                        {
                            new RequestSquadHistory().AddRoutes(endpoints);
                            new GetSquadHistory().AddRoutes(endpoints);
                        });
                    }))
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient(), queue);
        }

        private static HttpRequestMessage Post(string teamCode, string? user, bool refresh = false) =>
            new(HttpMethod.Post, $"/teams/{teamCode}/squad-history/requests")
            {
                Content = JsonContent.Create(new { seasonId = 22, teamName = "CD Ejemplo A", refresh }),
                Headers = { { "X-Test-User", user ?? string.Empty } }
            };

        private static string NewTeamCode() => $"E{Guid.NewGuid():N}"[..20];

        private async Task<SquadHistoryReport> SeedAsync(string teamCode, Action<SquadHistoryReport> arrange)
        {
            await using var db = _fixture.CreateFederationDbContext();
            var report = SquadHistoryReport.Create(teamCode, "CD Ejemplo A", 22, 21, "owner");
            arrange(report);
            db.SquadHistoryReports.Add(report);
            await db.SaveChangesAsync();
            return report;
        }

        [Fact]
        public async Task Post_sin_autenticar_devuelve_401()
        {
            var (host, client, _) = await StartHostAsync();
            using var _host = host;
            var request = new HttpRequestMessage(HttpMethod.Post, $"/teams/{NewTeamCode()}/squad-history/requests")
            {
                Content = JsonContent.Create(new { seasonId = 22, teamName = "X", refresh = false })
            };

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Post_sin_informe_crea_uno_pendiente_lo_encola_y_devuelve_202()
        {
            var (host, client, queue) = await StartHostAsync();
            using var _host = host;
            var teamCode = NewTeamCode();

            var response = await client.SendAsync(Post(teamCode, "user-1"));

            Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<RequestSquadHistory.SquadHistoryRequestResponse>(JsonOptions);
            Assert.Equal("Pending", body!.Status);
            Assert.Equal(new[] { body.ReportId }, queue.Enqueued);
            await using var db = _fixture.CreateFederationDbContext();
            var stored = await db.SquadHistoryReports.SingleAsync(r => r.TeamCode == teamCode);
            Assert.Equal(21, stored.PreviousSeasonId);
        }

        [Fact]
        public async Task Post_con_informe_completado_devuelve_200_sin_encolar()
        {
            var (host, client, queue) = await StartHostAsync();
            using var _host = host;
            var teamCode = NewTeamCode();
            await SeedAsync(teamCode, r => r.Complete(Array.Empty<SquadHistoryEntry>()));

            var response = await client.SendAsync(Post(teamCode, "user-1"));

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Empty(queue.Enqueued);
        }

        [Fact]
        public async Task Post_con_informe_en_curso_suscribe_al_usuario_sin_reencolar()
        {
            var (host, client, queue) = await StartHostAsync();
            using var _host = host;
            var teamCode = NewTeamCode();
            var report = await SeedAsync(teamCode, r => r.Start(10));

            var response = await client.SendAsync(Post(teamCode, "user-2"));

            Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
            Assert.Empty(queue.Enqueued);
            await using var db = _fixture.CreateFederationDbContext();
            Assert.True(await db.SquadHistorySubscribers.AnyAsync(s => s.ReportId == report.Id && s.UserId == "user-2"));
        }

        [Fact]
        public async Task Post_con_refresh_de_un_informe_completado_lo_reencola()
        {
            var (host, client, queue) = await StartHostAsync();
            using var _host = host;
            var teamCode = NewTeamCode();
            var report = await SeedAsync(teamCode, r => r.Complete(Array.Empty<SquadHistoryEntry>()));

            var response = await client.SendAsync(Post(teamCode, "user-1", refresh: true));

            Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
            Assert.Equal(new[] { report.Id }, queue.Enqueued);
        }

        [Fact]
        public async Task Get_sin_informe_devuelve_404_problem_details()
        {
            var (host, client, _) = await StartHostAsync();
            using var _host = host;
            var request = new HttpRequestMessage(HttpMethod.Get, $"/teams/{NewTeamCode()}/squad-history?seasonId=22");
            request.Headers.Add("X-Test-User", "user-1");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        }

        [Fact]
        public async Task Get_devuelve_las_entradas_agrupadas_por_jugador_y_temporada()
        {
            var (host, client, _) = await StartHostAsync();
            using var _host = host;
            var teamCode = NewTeamCode();
            await SeedAsync(teamCode, r => r.Complete(new[]
            {
                Entry("P1", "ZETA", 22, "E1"),
                Entry("P1", "ZETA", 21, "E2"),
                Entry("P1", "ZETA", 21, "E3"),
                Entry("P2", "ALFA", 22, "E1")
            }));
            var request = new HttpRequestMessage(HttpMethod.Get, $"/teams/{teamCode}/squad-history?seasonId=22");
            request.Headers.Add("X-Test-User", "user-1");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<GetSquadHistory.SquadHistoryResponse>(JsonOptions);
            Assert.Equal("Completed", body!.Status);
            Assert.Equal(new[] { "ALFA", "ZETA" }, body.Players.Select(p => p.PlayerName));
            var zeta = body.Players[1];
            Assert.Equal(new[] { 22, 21 }, zeta.Seasons.Select(s => s.SeasonId));
            Assert.Equal(2, zeta.Seasons[1].Teams.Count);
        }

        [Fact]
        public async Task Get_expone_posibles_jugadores_con_anio_de_nacimiento_y_procedencia()
        {
            var (host, client, _) = await StartHostAsync();
            using var _host = host;
            var teamCode = NewTeamCode();
            await SeedAsync(teamCode, r =>
            {
                r.Start(1);
                r.MarkAsCandidateSquad("Nota de búsqueda");
                r.Complete(new[] { Entry("P1", "ZETA", 21, "E1", birthYear: 2012, origin: "Club Infantil A") });
            });
            var request = new HttpRequestMessage(HttpMethod.Get, $"/teams/{teamCode}/squad-history?seasonId=22");
            request.Headers.Add("X-Test-User", "user-1");

            var response = await client.SendAsync(request);

            var body = await response.Content.ReadFromJsonAsync<GetSquadHistory.SquadHistoryResponse>(JsonOptions);
            Assert.True(body!.IsCandidateSquad);
            Assert.Equal("Nota de búsqueda", body.CandidateSearchNote);
            var player = Assert.Single(body.Players);
            Assert.Equal((2012, "Club Infantil A"), (player.BirthYear!.Value, player.OriginTeamName));
        }

        private static SquadHistoryEntry Entry(string player, string name, int season, string team,
            int? birthYear = null, string? origin = null) =>
            SquadHistoryEntry.Create(player, name, season, $"T{season}", "10", "Liga", "20", "Grupo", team, $"Equipo {team}",
                "Club", null, 30, 2, 1, 0, 0, 3, 4, SquadHistorySource.PlayerSheet, false, birthYear, origin);
    }
}
