using RFFM.Api.Features.Federation.SquadHistory;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class RequestSquadHistoryValidatorTests
    {
        private static RequestSquadHistory.RequestSquadHistoryCommand Command(string teamCode = "555", int seasonId = 22, string userId = "u") =>
            new(teamCode, seasonId, "CD Ejemplo A", false, userId);

        [Fact]
        public void Comando_valido_no_tiene_errores()
        {
            Assert.True(new RequestSquadHistory.Validator().Validate(Command()).IsValid);
        }

        [Theory]
        [InlineData("", 22)]
        [InlineData("555", 0)]
        public void Falla_sin_equipo_o_con_temporada_invalida(string teamCode, int seasonId)
        {
            Assert.False(new RequestSquadHistory.Validator().Validate(Command(teamCode, seasonId)).IsValid);
        }

        [Fact]
        public void Falla_con_codigo_de_equipo_demasiado_largo()
        {
            Assert.False(new RequestSquadHistory.Validator().Validate(Command(new string('9', 51))).IsValid);
        }
    }
}
