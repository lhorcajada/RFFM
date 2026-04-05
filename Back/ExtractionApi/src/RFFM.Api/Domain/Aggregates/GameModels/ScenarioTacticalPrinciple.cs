namespace RFFM.Api.Domain.Aggregates.GameModels
{
    /// <summary>Join table: scenario ↔ TechnicalGoals (tactical principle).</summary>
    public class ScenarioTacticalPrinciple
    {
        public string GameScenarioId { get; private set; } = null!;
        public int TechnicalGoalId { get; private set; }

        public GameScenario GameScenario { get; private set; } = null!;

        private ScenarioTacticalPrinciple() { }

        public ScenarioTacticalPrinciple(string gameScenarioId, int technicalGoalId)
        {
            GameScenarioId = gameScenarioId;
            TechnicalGoalId = technicalGoalId;
        }
    }
}
