using RFFM.Api.Features.Federation.Teams.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class ActaParserTests
    {
        private const string ActaJson = """
            {"props":{"pageProps":{"acta":{
              "codacta":"A1","codigo_equipo_local":"555","codigo_equipo_visitante":"777",
              "jugadores_equipo_local":[{"codjugador":"1","nombre_jugador":"UNO","titular":"1","suplente":"0"}],
              "jugadores_equipo_visitante":[{"codjugador":"2","nombre_jugador":"DOS","titular":"0","suplente":"1"}],
              "goles_equipo_local":[{"codjugador":"1","minuto":"10","tipo_gol":"100"}],
              "goles_equipo_visitante":[],
              "tarjetas_equipo_local":[{"codigo_tipo_amonestacion":"100","codjugador":"1","segunda_amarilla":"0"}],
              "tarjetas_equipo_visitante":[]
            }}}}
            """;

        [Fact]
        public void Parse_devuelve_alineaciones_goles_y_tarjetas()
        {
            var html = $"<html><script id=\"__NEXT_DATA__\">{ActaJson}</script></html>";

            var acta = ActaParser.Parse(html);

            Assert.NotNull(acta);
            Assert.Equal("555", acta!.LocalTeamCode);
            Assert.Equal("1", Assert.Single(acta.LocalPlayers).PlayerCode);
            Assert.Equal("2", Assert.Single(acta.AwayPlayers).PlayerCode);
            Assert.Equal("1", Assert.Single(acta.LocalGoalsList).PlayerCode);
            Assert.Equal("100", Assert.Single(acta.LocalCards).CardType);
        }

        [Fact]
        public void Parse_devuelve_null_con_html_sin_datos()
        {
            Assert.Null(ActaParser.Parse("<html><body>nada</body></html>"));
        }
    }
}
