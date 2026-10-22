namespace RFFM.Api.Domain.Services.MatchSimulation
{
    /// <summary>Entrada de la simulación tal como se habría visto antes de jugarse una jornada (design.md D2).</summary>
    public static class SimulationAsOf
    {
        public static SimulationInput AsOfRound(SimulationInput input, int round, bool ignoreCurrentInvolvement)
        {
            var calendar = input.Calendar
                .Select(m => m.Round >= round ? m with { LocalGoals = null, VisitorGoals = null } : m)
                .ToList();

            var squads = ignoreCurrentInvolvement
                ? input.SquadsByTeam.ToDictionary(
                    s => s.Key,
                    s => (IReadOnlyList<SimPlayer>)s.Value
                        .Select(p => p with { CurrentCalled = 0, CurrentStarter = 0, CurrentSubstitute = 0 })
                        .ToList())
                : input.SquadsByTeam;

            return input with { Calendar = calendar, SquadsByTeam = squads };
        }
    }
}
