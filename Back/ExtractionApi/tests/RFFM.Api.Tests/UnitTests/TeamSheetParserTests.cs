using RFFM.Api.Features.Federation.Teams.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class TeamSheetParserTests
    {
        [Fact]
        public void Parse_devuelve_nombre_y_jugadores_del_equipo()
        {
            const string json = """
                {"props":{"pageProps":{"team":{"nombre_equipo":"CD Ejemplo A",
                  "jugadores_equipo":[{"cod_jugador":"1","nombre":"UNO"},{"cod_jugador":"2","nombre":"DOS"}]}}}}
                """;
            var html = $"<html><script id=\"__NEXT_DATA__\" type=\"application/json\">{json}</script></html>";

            var team = TeamSheetParser.Parse(html);

            Assert.NotNull(team);
            Assert.Equal("CD Ejemplo A", team!.TeamName);
            Assert.Equal(new[] { "1", "2" }, team.Players.ConvertAll(p => p.PlayerCode));
        }

        [Fact]
        public void Parse_devuelve_null_sin_next_data()
        {
            Assert.Null(TeamSheetParser.Parse("<html></html>"));
        }
    }
}
