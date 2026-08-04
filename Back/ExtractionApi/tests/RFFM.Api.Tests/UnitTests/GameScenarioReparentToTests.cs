#nullable enable
using RFFM.Api.Domain.Aggregates.GameModels;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class GameScenarioReparentToTests
    {
        [Fact]
        public void ReparentTo_ChangesGamePrincipleId()
        {
            var scenario = new GameScenario("principle-1", 1, "Escenario 1", "Contexto");

            scenario.ReparentTo("principle-2");

            Assert.Equal("principle-2", scenario.GamePrincipleId);
        }
    }
}
