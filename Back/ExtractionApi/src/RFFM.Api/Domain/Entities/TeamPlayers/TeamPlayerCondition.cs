using RFFM.Api.Features.Coaches.Players.Services;

namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    /// <summary>
    /// Persisted Forma física (fitness) / Cansancio (fatigue) checkpoint for a player, one row
    /// per <see cref="TeamPlayer"/>. Advanced incrementally day by day by
    /// <see cref="Features.Coaches.Players.Services.PlayerConditionRecalculationService"/> — see
    /// openspec/changes/player-physical-condition-fatigue/design.md → Decisión 1.
    /// </summary>
    public class TeamPlayerCondition : BaseEntity
    {
        public string TeamPlayerId { get; private set; } = null!;
        public double PhysicalFitness { get; private set; }
        public double Fatigue { get; private set; }
        public DateTime LastCalculatedDate { get; private set; }

        public TeamPlayer TeamPlayer { get; private set; } = null!;

        private TeamPlayerCondition() { }

        public static TeamPlayerCondition CreateInitial(string teamPlayerId, DateTime asOfDate) =>
            new()
            {
                TeamPlayerId = teamPlayerId,
                PhysicalFitness = PlayerConditionDayEffect.InitialFitness,
                Fatigue = PlayerConditionDayEffect.InitialFatigue,
                LastCalculatedDate = asOfDate,
            };

        public void Advance(double fitnessDelta, double fatigueDelta, DateTime newDate)
        {
            PhysicalFitness = Math.Clamp(PhysicalFitness + fitnessDelta, 0, 100);
            Fatigue = Math.Clamp(Fatigue + fatigueDelta, 0, 100);
            LastCalculatedDate = newDate;
        }
    }
}
