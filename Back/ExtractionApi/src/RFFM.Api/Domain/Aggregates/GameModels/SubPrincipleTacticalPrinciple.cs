namespace RFFM.Api.Domain.Aggregates.GameModels
{
    /// <summary>Join table: sub-principle ↔ TechnicalGoals (tactical principle).</summary>
    public class SubPrincipleTacticalPrinciple
    {
        public string SubPrincipleId { get; private set; } = null!;
        public int TechnicalGoalId { get; private set; }

        public SubPrinciple SubPrinciple { get; private set; } = null!;

        private SubPrincipleTacticalPrinciple() { }

        public SubPrincipleTacticalPrinciple(string subPrincipleId, int technicalGoalId)
        {
            SubPrincipleId = subPrincipleId;
            TechnicalGoalId = technicalGoalId;
        }
    }
}
