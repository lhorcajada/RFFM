#nullable enable
using RFFM.Api.Domain.Entities.TeamPlayers;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Covers the automatic-sanction fields added for player-card-tracking-and-suspensions:
    /// IsAutomatic, Fine, SourceEventId, and the new CreateAutomatic factory.
    /// </summary>
    public class TeamPlayerSanctionTests
    {
        [Fact]
        public void Create_Manual_HasIsAutomaticFalseAndNoSourceEventId()
        {
            var sanction = TeamPlayerSanction.Create(
                "team-player-1", SanctionCategory.Competition, DateTime.UtcNow, "Expulsión",
                "Motivo manual", "2 partidos");

            Assert.False(sanction.IsAutomatic);
            Assert.Null(sanction.SourceEventId);
            Assert.Null(sanction.Fine);
            Assert.Null(sanction.EndDate);
        }

        [Fact]
        public void Create_Manual_WithFine_PersistsFine()
        {
            var sanction = TeamPlayerSanction.Create(
                "team-player-1", SanctionCategory.Competition, DateTime.UtcNow, "Expulsión",
                "Motivo manual", "2 partidos", fine: 50m);

            Assert.Equal(50m, sanction.Fine);
            Assert.False(sanction.IsAutomatic);
        }

        [Fact]
        public void CreateAutomatic_ProducesIsAutomaticTrueAndEndDateNull()
        {
            var sanction = TeamPlayerSanction.CreateAutomatic(
                "team-player-1", SanctionCategory.Competition, DateTime.UtcNow, "Amarillas acumuladas (5)",
                "Generada automáticamente: 5ª tarjeta amarilla en el partido del ... vs ...", "event-1");

            Assert.True(sanction.IsAutomatic);
            Assert.Null(sanction.EndDate);
            Assert.Null(sanction.Fine);
            Assert.Equal("event-1", sanction.SourceEventId);
            Assert.Equal("Amarillas acumuladas (5)", sanction.SanctionType);
        }

        [Fact]
        public void CreateAutomatic_WithoutSourceEventId_Throws()
        {
            Assert.Throws<ArgumentException>(() => TeamPlayerSanction.CreateAutomatic(
                "team-player-1", SanctionCategory.Competition, DateTime.UtcNow, "Tarjeta roja",
                "Generada automáticamente", sourceEventId: null!));
        }

        [Fact]
        public void Update_WithFine_PersistsFineAndPreservesIsAutomaticAndSourceEventId()
        {
            var sanction = TeamPlayerSanction.CreateAutomatic(
                "team-player-1", SanctionCategory.Competition, DateTime.UtcNow, "Tarjeta roja",
                "Generada automáticamente", "event-1");

            sanction.Update(SanctionCategory.Competition, sanction.StartDate, "Tarjeta roja", "Descripción editada", null, null, fine: 25.5m);

            Assert.Equal(25.5m, sanction.Fine);
            Assert.Equal("Descripción editada", sanction.Description);
            Assert.True(sanction.IsAutomatic);
            Assert.Equal("event-1", sanction.SourceEventId);
        }

        [Fact]
        public void Update_SettingEndDate_LiftsSanction()
        {
            var sanction = TeamPlayerSanction.Create(
                "team-player-1", SanctionCategory.Competition, DateTime.UtcNow, "Expulsión", null, null);

            var endDate = DateTime.UtcNow;
            sanction.Update(SanctionCategory.Competition, sanction.StartDate, "Expulsión", null, null, endDate);

            Assert.NotNull(sanction.EndDate);
        }
    }
}
