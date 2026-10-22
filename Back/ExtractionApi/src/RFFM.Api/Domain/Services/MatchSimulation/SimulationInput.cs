using RFFM.Api.Domain.Entities.Federation.Results;

namespace RFFM.Api.Domain.Services.MatchSimulation
{
    public record SimTeam(string Code, string Name, string? ShieldUrl);

    public record SimMatch(int Round, string LocalCode, string VisitorCode, int? LocalGoals, int? VisitorGoals, DateOnly? Date)
    {
        public bool HasResult => LocalGoals.HasValue && VisitorGoals.HasValue;
    }

    public record SimPlayerParticipation(string CompetitionName, string GroupName, int TeamPosition);

    /// <summary>Jugador de una plantilla: implicación en la temporada actual y totales de la anterior.</summary>
    public record SimPlayer(
        int CurrentCalled, int CurrentStarter, int CurrentSubstitute,
        bool HasPreviousSeason, int PreviousCalled, int PreviousStarter, int PreviousPlayed, int PreviousGoals,
        IReadOnlyList<SimPlayerParticipation> PreviousParticipations);

    public record SimulationInput(
        IReadOnlyList<SimTeam> Teams,
        IReadOnlyList<SimMatch> Calendar,
        IReadOnlyDictionary<string, IReadOnlyList<SimPlayer>> SquadsByTeam,
        RffmPointsSystem Points,
        IReadOnlyDictionary<string, int> SanctionPoints);
}
