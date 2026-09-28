using RFFM.Api.Features.Federation.Players.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class PlayerSheetParserTests
    {
        private const string PlayerJson = """
            {"props":{"pageProps":{"player":{
              "nombre_jugador":"LUCAS PEREZ","edad":"14","equipo":"CD Ejemplo A","codigo_equipo":"555",
              "partidos":[
                {"nombre":"Convocados","valor":"20"},
                {"nombre":"Titular","valor":"15"},
                {"nombre":"Total goles","valor":"7"}
              ],
              "tarjetas":[
                {"codigo_tipo_tarjeta":"100","valor":"3"},
                {"codigo_tipo_tarjeta":"101","valor":"1"},
                {"codigo_tipo_tarjeta":"102","valor":"2"}
              ],
              "competiciones_participa":[
                {"nombre_competicion":"Liga Infantil","codigo_competicion":"10","codgrupo":"20","nombre_grupo":"Grupo 1",
                 "codequipo":"555","nombre_equipo":"CD Ejemplo A","nombre_club":"CD Ejemplo","posicion_equipo":"2",
                 "puntos_equipo":"40","escudo_equipo":"esc.png","ver_estadisticas":"1"}
              ]
            }}}}
            """;

        private static string Html(string json) =>
            $"<html><body><script id=\"__NEXT_DATA__\" type=\"application/json\">{json}</script></body></html>";

        [Fact]
        public void Parse_devuelve_participaciones_con_equipo_club_y_puntos()
        {
            var player = PlayerSheetParser.Parse(Html(PlayerJson), "123", 21);

            Assert.NotNull(player);
            var competition = Assert.Single(player!.Competitions);
            Assert.Equal("555", competition.TeamCode);
            Assert.Equal("CD Ejemplo", competition.ClubName);
            Assert.Equal("20", competition.GroupCode);
            Assert.Equal(40, competition.TeamPoints);
            Assert.Equal(2, competition.TeamPosition);
        }

        [Fact]
        public void Parse_devuelve_totales_de_partidos_y_tarjetas()
        {
            var player = PlayerSheetParser.Parse(Html(PlayerJson), "123", 21)!;

            Assert.Equal((20, 15, 7), (player.Matches.Called, player.Matches.Starter, player.Matches.TotalGoals));
            Assert.Equal((3, 1, 2), (player.Cards.Yellow, player.Cards.Red, player.Cards.DoubleYellow));
        }

        [Fact]
        public void Parse_devuelve_null_sin_next_data()
        {
            Assert.Null(PlayerSheetParser.Parse("<html><body>sin datos</body></html>", "123", 21));
        }
    }
}
