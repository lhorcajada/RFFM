using RFFM.Api.Features.Coaches.SportEvents.Queries;

namespace RFFM.Api.Features.Coaches.Players.Services
{
    /// <summary>
    /// Shared helper used by <see cref="PlayerFatigueCalculator"/> and <see cref="PlayerReadinessCalculator"/>
    /// to weigh a match's minutes by its event type (Estado de forma ya no lo usa: el tipo de partido no pesa allí) —
    /// unlike training types, the user asked for the same order (Liga > Amistoso/Torneo) across the
    /// metrics that use it, so a single shared table suffices. See
    /// openspec/changes/player-form-status-training-match-weighting/design.md → Decisión 2.
    /// </summary>
    public static class MatchTypeWeighting
    {
        public static double Weight(int eventTypeId) => eventTypeId switch
        {
            SportEventsConstants.MatchEventTypeId => 1.00,
            SportEventsConstants.FriendlyEventTypeId => 0.70,
            SportEventsConstants.TournamentEventTypeId => 0.70,
            _ => 1.00 // cualquier otro/no reconocido: peso neutro, defensivo
        };
    }
}
