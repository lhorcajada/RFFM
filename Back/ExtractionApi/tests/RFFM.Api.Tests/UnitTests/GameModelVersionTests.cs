#nullable enable
using System;
using RFFM.Api.Domain.Aggregates.GameModels;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class GameModelVersionTests
    {
        [Fact]
        public void NewGameModel_HasNonEmptyVersion()
        {
            var model = new GameModel("team-1", "Modelo de prueba", "2025-2026");

            Assert.NotEqual(Guid.Empty, model.Version);
        }

        [Fact]
        public void Touch_ReplacesVersion()
        {
            var model = new GameModel("team-1", "Modelo de prueba", "2025-2026");
            var previousVersion = model.Version;

            model.Touch();

            Assert.NotEqual(previousVersion, model.Version);
        }
    }
}
