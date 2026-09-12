using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Domain.Entities.Teams
{
    /// <summary>
    /// One row per balance-affecting event of a team's fund ("bolsa del equipo"). The team's
    /// current balance is SUM(Amount) over its movements (see design.md Decisión 1). Each
    /// TeamPlayerSanction can have at most one movement with Source == SanctionPayment
    /// (enforced by a unique filtered index — see TeamFundMovementEntityConfiguration).
    /// </summary>
    public class TeamFundMovement : BaseEntity
    {
        public string TeamId { get; private set; } = null!;
        public decimal Amount { get; private set; }
        public TeamFundMovementSource Source { get; private set; } = null!;
        public string? SourceSanctionId { get; private set; }
        public DateTime OccurredAt { get; private set; }
        public string? Description { get; private set; }

        public Team Team { get; private set; } = null!;

        private TeamFundMovement() { }

        public static TeamFundMovement Create(
            string teamId, decimal amount, TeamFundMovementSource source,
            string? sourceSanctionId = null, DateTime? occurredAt = null, string? description = null)
        {
            if (string.IsNullOrWhiteSpace(teamId))
                throw new ArgumentException("El equipo es obligatorio.");
            if (source is null)
                throw new ArgumentException("El origen del movimiento es obligatorio.");
            if (amount == 0m)
                throw new ArgumentException("El importe del movimiento no puede ser cero.");

            var occurred = occurredAt ?? DateTime.UtcNow;

            return new TeamFundMovement
            {
                TeamId = teamId,
                Amount = amount,
                Source = source,
                SourceSanctionId = sourceSanctionId,
                OccurredAt = occurred.Kind == DateTimeKind.Utc ? occurred : DateTime.SpecifyKind(occurred, DateTimeKind.Utc),
                Description = description
            };
        }

        /// <summary>Updates this movement's Amount in place (design.md Decisión 2: an edit to a
        /// sanction's AmountPaid updates the same movement rather than appending a new row).
        /// Unlike Create, zero is allowed here — it represents "payment recorded then reversed"
        /// (a decrease to null/0, or a deleted sanction), keeping the row for audit continuity.</summary>
        public void AdjustAmount(decimal amount)
        {
            if (amount < 0m)
                throw new ArgumentException("El importe del movimiento no puede ser negativo.");

            Amount = amount;
        }
    }
}
