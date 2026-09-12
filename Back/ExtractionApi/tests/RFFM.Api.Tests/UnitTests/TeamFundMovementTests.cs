#nullable enable
using RFFM.Api.Domain.Entities.Teams;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Covers TeamFundMovement, the ledger entity backing the per-team fund balance
    /// (add-team-fund-and-sanction-player-photo, design.md Decisión 1/2).
    /// </summary>
    public class TeamFundMovementTests
    {
        [Fact]
        public void Create_RequiresNonEmptyTeamId()
        {
            Assert.Throws<ArgumentException>(() => TeamFundMovement.Create(
                teamId: "  ", amount: 40m, source: TeamFundMovementSource.SanctionPayment, sourceSanctionId: "sanction-1"));
        }

        [Fact]
        public void Create_RejectsZeroAmount()
        {
            Assert.Throws<ArgumentException>(() => TeamFundMovement.Create(
                teamId: "team-1", amount: 0m, source: TeamFundMovementSource.SanctionPayment, sourceSanctionId: "sanction-1"));
        }

        [Fact]
        public void Create_WithoutOccurredAt_DefaultsToUtcNow()
        {
            var before = DateTime.UtcNow;
            var movement = TeamFundMovement.Create(
                teamId: "team-1", amount: 40m, source: TeamFundMovementSource.SanctionPayment, sourceSanctionId: "sanction-1");
            var after = DateTime.UtcNow;

            Assert.True(movement.OccurredAt >= before && movement.OccurredAt <= after);
            Assert.Equal(DateTimeKind.Utc, movement.OccurredAt.Kind);
        }

        [Fact]
        public void Create_PersistsAllFields()
        {
            var occurredAt = new DateTime(2026, 1, 1, 10, 0, 0, DateTimeKind.Utc);

            var movement = TeamFundMovement.Create(
                teamId: "team-1", amount: 40m, source: TeamFundMovementSource.SanctionPayment,
                sourceSanctionId: "sanction-1", occurredAt: occurredAt, description: "Pago de sanción");

            Assert.Equal("team-1", movement.TeamId);
            Assert.Equal(40m, movement.Amount);
            Assert.Equal(TeamFundMovementSource.SanctionPayment, movement.Source);
            Assert.Equal("sanction-1", movement.SourceSanctionId);
            Assert.Equal(occurredAt, movement.OccurredAt);
            Assert.Equal("Pago de sanción", movement.Description);
        }

        [Fact]
        public void AdjustAmount_UpdatesAmountInPlace_IncludingToZero()
        {
            var movement = TeamFundMovement.Create(
                teamId: "team-1", amount: 40m, source: TeamFundMovementSource.SanctionPayment, sourceSanctionId: "sanction-1");

            movement.AdjustAmount(70m);
            Assert.Equal(70m, movement.Amount);

            movement.AdjustAmount(0m);
            Assert.Equal(0m, movement.Amount);
        }

        [Fact]
        public void AdjustAmount_RejectsNegativeAmount()
        {
            var movement = TeamFundMovement.Create(
                teamId: "team-1", amount: 40m, source: TeamFundMovementSource.SanctionPayment, sourceSanctionId: "sanction-1");

            Assert.Throws<ArgumentException>(() => movement.AdjustAmount(-1m));
        }
    }
}
