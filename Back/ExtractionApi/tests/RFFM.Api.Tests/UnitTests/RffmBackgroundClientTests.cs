using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using RFFM.Api.Features.Federation.SquadHistory.Services;
using RFFM.Api.Infrastructure.Options;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class RffmBackgroundClientTests
    {
        private sealed class RoutingHandler : HttpMessageHandler
        {
            private readonly Func<Uri, (HttpStatusCode Status, string Body)> _route;
            public List<string> Requested { get; } = new();

            public RoutingHandler(Func<Uri, (HttpStatusCode, string)> route) => _route = route;

            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                lock (Requested) Requested.Add(request.RequestUri!.PathAndQuery);
                var (status, body) = _route(request.RequestUri!);
                return Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body) });
            }
        }

        private static IRffmBackgroundClient BuildClient(RoutingHandler handler)
        {
            var services = new ServiceCollection();
            services.Configure<RffmOptions>(o =>
            {
                o.BackgroundMinDelayMs = 1;
                o.BackgroundRetryBaseDelayMs = 1;
            });
            services.AddRffmBackgroundHttpClient().ConfigurePrimaryHttpMessageHandler(() => handler);
            services.AddTransient<IRffmBackgroundClient, RffmBackgroundClient>();
            return services.BuildServiceProvider().GetRequiredService<IRffmBackgroundClient>();
        }

        private static string Round(int round, string matchesJson) => $$"""
            {"jornada":"{{round}}",
             "listado_jornadas":[{"jornadas":[
                {"codjornada":"1","fecha_jornada":"13-09-2000"},
                {"codjornada":"2","fecha_jornada":"20-09-2000"},
                {"codjornada":"3","fecha_jornada":"27-09-2999"}]}],
             "partidos":{{matchesJson}}}
            """;

        [Fact]
        public async Task GetGroupPlayedMatches_devuelve_partidos_con_acta_y_no_pide_jornadas_futuras()
        {
            var handler = new RoutingHandler(uri => uri.Query.Contains("round=1")
                ? (HttpStatusCode.OK, Round(1, """[{"codacta":"A1","hay_actas":"1","CodEquipo_local":"10","CodEquipo_visitante":"20"}]"""))
                : uri.Query.Contains("round=2")
                    ? (HttpStatusCode.OK, Round(2, """[{"codacta":"","hay_actas":"0","CodEquipo_local":"20","CodEquipo_visitante":"10"}]"""))
                    : (HttpStatusCode.OK, Round(3, "[]")));
            var client = BuildClient(handler);

            var matches = await client.GetGroupPlayedMatchesAsync("99", CancellationToken.None);

            var match = Assert.Single(matches);
            Assert.Equal(("A1", "10", "20"), (match.RecordCode, match.LocalTeamCode, match.VisitorTeamCode));
            Assert.DoesNotContain(handler.Requested, r => r.Contains("round=3"));
        }

        [Fact]
        public async Task GetTeamLastPlayedMatches_devuelve_los_ultimos_partidos_con_acta_del_equipo_empezando_por_el_final()
        {
            var handler = new RoutingHandler(uri => uri.Query.Contains("round=1")
                ? (HttpStatusCode.OK, Round(1, """
                    [{"codacta":"A1","hay_actas":"1","CodEquipo_local":"10","CodEquipo_visitante":"20"},
                     {"codacta":"B1","hay_actas":"1","CodEquipo_local":"30","CodEquipo_visitante":"40"}]
                    """))
                : uri.Query.Contains("round=2")
                    ? (HttpStatusCode.OK, Round(2, """
                        [{"codacta":"A2","hay_actas":"1","CodEquipo_local":"20","CodEquipo_visitante":"10"},
                         {"codacta":"B2","hay_actas":"1","CodEquipo_local":"40","CodEquipo_visitante":"30"}]
                        """))
                    : (HttpStatusCode.OK, Round(3, "[]")));
            var client = BuildClient(handler);

            var matches = await client.GetTeamLastPlayedMatchesAsync("99", "10", 1, CancellationToken.None);

            Assert.Equal("A2", Assert.Single(matches).RecordCode);
            Assert.DoesNotContain(handler.Requested, r => r.Contains("round=3"));
        }

        [Fact]
        public async Task GetTeamLastPlayedMatches_recorre_jornadas_hacia_atras_hasta_reunir_los_pedidos()
        {
            var handler = new RoutingHandler(uri => uri.Query.Contains("round=1")
                ? (HttpStatusCode.OK, Round(1, """[{"codacta":"A1","hay_actas":"1","CodEquipo_local":"10","CodEquipo_visitante":"20"}]"""))
                : (HttpStatusCode.OK, Round(2, """[{"codacta":"X2","hay_actas":"1","CodEquipo_local":"30","CodEquipo_visitante":"40"}]""")));
            var client = BuildClient(handler);

            var matches = await client.GetTeamLastPlayedMatchesAsync("99", "10", 2, CancellationToken.None);

            Assert.Equal("A1", Assert.Single(matches).RecordCode);
        }

        [Fact]
        public async Task GetClubTeams_pide_la_ficha_del_club_de_la_temporada()
        {
            const string json = """{"props":{"pageProps":{"club":{"equipos_club":[{"codigo_equipo":"101","nombre_equipo":"CLUB A","categoria":"PRIMERA CADETE"}]}}}}""";
            var handler = new RoutingHandler(_ => (HttpStatusCode.OK, $"<script id=\"__NEXT_DATA__\">{json}</script>"));
            var client = BuildClient(handler);

            var teams = await client.GetClubTeamsAsync("1037", 21, CancellationToken.None);

            Assert.Equal("101", Assert.Single(teams).TeamCode);
            Assert.Equal("/fichaclub/1037?temporada=21", Assert.Single(handler.Requested));
        }

        [Fact]
        public async Task GetCompetitions_devuelve_codigo_nombre_y_grupo_de_categoria()
        {
            var handler = new RoutingHandler(_ => (HttpStatusCode.OK,
                """[{"codigo":"24037562","nombre":"PRIMERA CADETE","nombre_grupo_categoria":"CADETES"}]"""));
            var client = BuildClient(handler);

            var competitions = await client.GetCompetitionsAsync(21, CancellationToken.None);

            var competition = Assert.Single(competitions);
            Assert.Equal(("24037562", "PRIMERA CADETE", "CADETES"), (competition.Code, competition.Name, competition.CategoryGroup));
            Assert.Equal("/api/competitions?temporada=21&tipojuego=1", Assert.Single(handler.Requested));
        }

        [Fact]
        public async Task GetGroups_devuelve_los_grupos_de_la_competicion()
        {
            var handler = new RoutingHandler(_ => (HttpStatusCode.OK,
                """[{"codigo":"24037563","nombre":"Grupo 1","total_jornadas":"30"}]"""));
            var client = BuildClient(handler);

            var groups = await client.GetGroupsAsync("24037562", CancellationToken.None);

            Assert.Equal(("24037563", "Grupo 1"), (Assert.Single(groups).Code, groups[0].Name));
            Assert.Equal("/api/groups?competicion=24037562", Assert.Single(handler.Requested));
        }

        [Fact]
        public async Task GetGroupTeams_devuelve_los_equipos_de_la_primera_jornada_sin_duplicar()
        {
            var handler = new RoutingHandler(_ => (HttpStatusCode.OK, Round(1, """
                [{"codacta":"","CodEquipo_local":"10","Nombre_equipo_local":"CLUB A","CodEquipo_visitante":"20","Nombre_equipo_visitante":"OTRO"},
                 {"codacta":"","CodEquipo_local":"30","Nombre_equipo_local":"TERCERO","CodEquipo_visitante":"10","Nombre_equipo_visitante":"CLUB A"}]
                """)));
            var client = BuildClient(handler);

            var teams = await client.GetGroupTeamsAsync("99", CancellationToken.None);

            Assert.Equal(new[] { "10", "20", "30" }, teams.Select(t => t.TeamCode).OrderBy(c => c));
            Assert.Equal("CLUB A", teams.Single(t => t.TeamCode == "10").TeamName);
            Assert.Equal("/api/results?idGroup=99&round=1", Assert.Single(handler.Requested));
        }

        [Fact]
        public async Task GetPlayerSheet_devuelve_null_con_404()
        {
            var client = BuildClient(new RoutingHandler(_ => (HttpStatusCode.NotFound, "")));

            Assert.Null(await client.GetPlayerSheetAsync("1", 21, CancellationToken.None));
        }

        [Fact]
        public async Task GetPlayerSheet_lanza_excepcion_si_el_error_persiste_tras_los_reintentos()
        {
            var handler = new RoutingHandler(_ => (HttpStatusCode.InternalServerError, ""));
            var client = BuildClient(handler);

            await Assert.ThrowsAsync<HttpRequestException>(() => client.GetPlayerSheetAsync("1", 21, CancellationToken.None));
            Assert.Equal(5, handler.Requested.Count);
        }
    }
}
