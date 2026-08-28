#nullable enable
using System.Linq;
using RFFM.Api.Domain.Aggregates.Assistances;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class SportEventTypeTests
    {
        [Fact]
        public void List_IncludesTournament_WithIdSix()
        {
            var tournament = SportEventType.List().SingleOrDefault(t => t.Id == 6);

            Assert.NotNull(tournament);
            Assert.Equal("Torneo", tournament!.Name);
        }

        [Fact]
        public void FromName_Torneo_ReturnsTournamentType()
        {
            var tournament = SportEventType.FromName("Torneo");

            Assert.Equal(6, tournament.Id);
        }

        [Fact]
        public void FromName_Torneo_IsCaseInsensitive()
        {
            var tournament = SportEventType.FromName("torneo");

            Assert.Equal(6, tournament.Id);
        }

        [Fact]
        public void From_Six_ReturnsTournamentType()
        {
            var tournament = SportEventType.From(6);

            Assert.Equal("Torneo", tournament.Name);
        }

        [Fact]
        public void ValidateEventType_Six_DoesNotThrow()
        {
            var exception = Record.Exception(() => SportEventType.ValidateEventType(6));

            Assert.Null(exception);
        }

        [Fact]
        public void List_StillContainsAllPreviousFiveTypes()
        {
            var types = SportEventType.List().ToList();

            Assert.Contains(types, t => t.Id == 1 && t.Name == "Partido");
            Assert.Contains(types, t => t.Id == 2 && t.Name == "Entrenamiento");
            Assert.Contains(types, t => t.Id == 3 && t.Name == "Reunión");
            Assert.Contains(types, t => t.Id == 4 && t.Name == "Amistoso");
            Assert.Contains(types, t => t.Id == 5 && t.Name == "Pruebas de acceso");
        }

        [Fact]
        public void TrainingId_ReturnsTwo()
        {
            Assert.Equal(2, SportEventType.TrainingId);
        }
    }
}
