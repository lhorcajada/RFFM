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

        // ── Sportive punishment / payment fields (extend-player-sanctions-enforcement-and-payments) ──

        [Fact]
        public void Create_MinutesLimit_RequiresTargetEventIdAndPositiveMinutesLimit()
        {
            Assert.Throws<ArgumentException>(() => TeamPlayerSanction.Create(
                "team-player-1", SanctionCategory.Competition, DateTime.UtcNow, "Sanción", null, null,
                sportivePunishmentType: SanctionSportivePunishmentType.MinutesLimit,
                targetEventId: null, minutesLimit: 10));

            Assert.Throws<ArgumentException>(() => TeamPlayerSanction.Create(
                "team-player-1", SanctionCategory.Competition, DateTime.UtcNow, "Sanción", null, null,
                sportivePunishmentType: SanctionSportivePunishmentType.MinutesLimit,
                targetEventId: "event-1", minutesLimit: 0));

            var sanction = TeamPlayerSanction.Create(
                "team-player-1", SanctionCategory.Competition, DateTime.UtcNow, "Sanción", null, null,
                sportivePunishmentType: SanctionSportivePunishmentType.MinutesLimit,
                targetEventId: "event-1", minutesLimit: 10);

            Assert.Equal(SanctionSportivePunishmentType.MinutesLimit, sanction.SportivePunishmentType);
            Assert.Equal("event-1", sanction.TargetEventId);
            Assert.Equal(10, sanction.MinutesLimit);
        }

        [Fact]
        public void Create_Deconvocation_RequiresTargetEventIdAndRejectsMinutesLimit()
        {
            Assert.Throws<ArgumentException>(() => TeamPlayerSanction.Create(
                "team-player-1", SanctionCategory.Competition, DateTime.UtcNow, "Sanción", null, null,
                sportivePunishmentType: SanctionSportivePunishmentType.Deconvocation,
                targetEventId: null));

            Assert.Throws<ArgumentException>(() => TeamPlayerSanction.Create(
                "team-player-1", SanctionCategory.Competition, DateTime.UtcNow, "Sanción", null, null,
                sportivePunishmentType: SanctionSportivePunishmentType.Deconvocation,
                targetEventId: "event-1", minutesLimit: 5));

            var sanction = TeamPlayerSanction.Create(
                "team-player-1", SanctionCategory.Competition, DateTime.UtcNow, "Sanción", null, null,
                sportivePunishmentType: SanctionSportivePunishmentType.Deconvocation,
                targetEventId: "event-1");

            Assert.Equal(SanctionSportivePunishmentType.Deconvocation, sanction.SportivePunishmentType);
            Assert.Equal("event-1", sanction.TargetEventId);
            Assert.Null(sanction.MinutesLimit);
        }

        [Fact]
        public void Create_NullSportivePunishmentType_RequiresTargetEventIdAndMinutesLimitBothNull()
        {
            Assert.Throws<ArgumentException>(() => TeamPlayerSanction.Create(
                "team-player-1", SanctionCategory.Competition, DateTime.UtcNow, "Sanción", null, null,
                sportivePunishmentType: null, targetEventId: "event-1"));

            Assert.Throws<ArgumentException>(() => TeamPlayerSanction.Create(
                "team-player-1", SanctionCategory.Competition, DateTime.UtcNow, "Sanción", null, null,
                sportivePunishmentType: null, minutesLimit: 10));

            var sanction = TeamPlayerSanction.Create(
                "team-player-1", SanctionCategory.Competition, DateTime.UtcNow, "Sanción", null, null);

            Assert.Null(sanction.SportivePunishmentType);
            Assert.Null(sanction.TargetEventId);
            Assert.Null(sanction.MinutesLimit);
        }

        [Fact]
        public void Create_AmountPaid_MustBeNonNegative()
        {
            Assert.Throws<ArgumentException>(() => TeamPlayerSanction.Create(
                "team-player-1", SanctionCategory.Competition, DateTime.UtcNow, "Sanción", null, null,
                amountPaid: -1m));

            var sanction = TeamPlayerSanction.Create(
                "team-player-1", SanctionCategory.Competition, DateTime.UtcNow, "Sanción", null, null,
                fine: 100m, amountPaid: 40m);

            Assert.Equal(40m, sanction.AmountPaid);
        }

        [Fact]
        public void MarkFulfilled_SetsEndDateAndLeavesOtherFieldsUntouched()
        {
            var sanction = TeamPlayerSanction.Create(
                "team-player-1", SanctionCategory.Competition, DateTime.UtcNow, "Sanción", "desc", null, fine: 30m);

            var at = DateTime.UtcNow;
            sanction.MarkFulfilled(at);

            Assert.Equal(at, sanction.EndDate);
            Assert.Equal("desc", sanction.Description);
            Assert.Equal(30m, sanction.Fine);
        }

        [Fact]
        public void Reopen_SetsEndDateBackToNullAndLeavesOtherFieldsUntouched()
        {
            var sanction = TeamPlayerSanction.Create(
                "team-player-1", SanctionCategory.Competition, DateTime.UtcNow, "Sanción", "desc", null, fine: 30m);
            sanction.MarkFulfilled(DateTime.UtcNow);

            sanction.Reopen();

            Assert.Null(sanction.EndDate);
            Assert.Equal("desc", sanction.Description);
            Assert.Equal(30m, sanction.Fine);
        }

        [Fact]
        public void Update_WithSportivePunishmentFields_PersistsThem()
        {
            var sanction = TeamPlayerSanction.Create(
                "team-player-1", SanctionCategory.Competition, DateTime.UtcNow, "Sanción", null, null);

            sanction.Update(
                SanctionCategory.Competition, sanction.StartDate, "Sanción", null, null, null,
                fine: 100m, amountPaid: 25m,
                sportivePunishmentType: SanctionSportivePunishmentType.MinutesLimit,
                targetEventId: "event-1", minutesLimit: 15);

            Assert.Equal(SanctionSportivePunishmentType.MinutesLimit, sanction.SportivePunishmentType);
            Assert.Equal("event-1", sanction.TargetEventId);
            Assert.Equal(15, sanction.MinutesLimit);
            Assert.Equal(25m, sanction.AmountPaid);
        }
    }
}
