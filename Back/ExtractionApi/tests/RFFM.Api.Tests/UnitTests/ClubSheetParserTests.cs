using RFFM.Api.Features.Federation.Clubs.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class ClubSheetParserTests
    {
        [Fact]
        public void ParseTeams_devuelve_los_equipos_del_club_con_su_categoria()
        {
            const string json = """
                {"props":{"pageProps":{"club":{"equipos_club":[
                  {"codigo_equipo":"101","nombre_equipo":"CLUB A","categoria":"PRIMERA CADETE","en_competicion":"1"},
                  {"codigo_equipo":102,"nombre_equipo":"CLUB B","categoria":"INFANTIL","en_competicion":"0"},
                  {"codigo_equipo":"","nombre_equipo":"SIN CODIGO","categoria":"INFANTIL"}
                ]}}}}
                """;
            var html = $"<html><script id=\"__NEXT_DATA__\" type=\"application/json\">{json}</script></html>";

            var teams = ClubSheetParser.ParseTeams(html);

            Assert.Equal(2, teams.Count);
            Assert.Equal(("101", "CLUB A", "PRIMERA CADETE", true), (teams[0].TeamCode, teams[0].TeamName, teams[0].CategoryDescription, teams[0].InCompetition));
            Assert.Equal("102", teams[1].TeamCode);
        }

        [Fact]
        public void ParseTeams_devuelve_vacio_sin_datos()
        {
            Assert.Empty(ClubSheetParser.ParseTeams("<html></html>"));
        }
    }
}
