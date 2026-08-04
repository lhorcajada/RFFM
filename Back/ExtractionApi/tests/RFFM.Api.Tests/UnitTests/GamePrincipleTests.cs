#nullable enable
using System;
using RFFM.Api.Domain.Aggregates.GameModels;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class GamePrincipleTests
    {
        [Fact]
        public void Create_WithValidTitle_SetsProperties()
        {
            var principle = new GamePrinciple("game-model-1", gameMomentId: 1, gameZoneId: 2, order: 1, "Principio 1", "Descripcion");

            Assert.Equal("game-model-1", principle.GameModelId);
            Assert.Equal(1, principle.GameMomentId);
            Assert.Equal(2, principle.GameZoneId);
            Assert.Equal(1, principle.Order);
            Assert.Equal("Principio 1", principle.Title);
            Assert.Equal("Descripcion", principle.Description);
            Assert.Empty(principle.Scenarios);
        }

        [Fact]
        public void Create_WithNullDescription_DefaultsToEmptyString()
        {
            var principle = new GamePrinciple("game-model-1", 1, 1, 1, "Principio 1", null!);

            Assert.Equal(string.Empty, principle.Description);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptyTitle_Throws(string? title)
        {
            Assert.Throws<ArgumentException>(() => new GamePrinciple("game-model-1", 1, 1, 1, title!, "Descripcion"));
        }

        [Fact]
        public void UpdateTitle_WithValidValue_TrimsAndSets()
        {
            var principle = new GamePrinciple("game-model-1", 1, 1, 1, "Principio 1", "Descripcion");

            principle.UpdateTitle("  Nuevo titulo  ");

            Assert.Equal("Nuevo titulo", principle.Title);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void UpdateTitle_WithEmptyValue_Throws(string? title)
        {
            var principle = new GamePrinciple("game-model-1", 1, 1, 1, "Principio 1", "Descripcion");

            Assert.Throws<ArgumentException>(() => principle.UpdateTitle(title!));
        }

        [Fact]
        public void UpdateDescription_SetsNewValue()
        {
            var principle = new GamePrinciple("game-model-1", 1, 1, 1, "Principio 1", "Descripcion");

            principle.UpdateDescription("Nueva descripcion");

            Assert.Equal("Nueva descripcion", principle.Description);
        }

        [Fact]
        public void UpdateDescription_WithNull_SetsEmptyString()
        {
            var principle = new GamePrinciple("game-model-1", 1, 1, 1, "Principio 1", "Descripcion");

            principle.UpdateDescription(null!);

            Assert.Equal(string.Empty, principle.Description);
        }

        [Fact]
        public void UpdateOrder_SetsNewValue()
        {
            var principle = new GamePrinciple("game-model-1", 1, 1, 1, "Principio 1", "Descripcion");

            principle.UpdateOrder(5);

            Assert.Equal(5, principle.Order);
        }
    }
}
