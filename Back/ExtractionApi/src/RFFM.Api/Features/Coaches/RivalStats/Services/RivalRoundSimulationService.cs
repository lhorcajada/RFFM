using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Domain.Services.MatchSimulation;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.RivalStats.Services
{
    /// <summary>
    /// Guarda la simulación previa a cada jornada de la liga: se recalcula mientras la jornada no ha empezado
    /// y se congela al empezar. Las jornadas ya empezadas sin simulación se calculan a posteriori, sin la
    /// implicación actual de los jugadores (design.md D3).
    /// </summary>
    public class RivalRoundSimulationService(FederationDbContext db, RivalSimulationInputLoader loader, TimeProvider timeProvider)
    {
        public static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

        public async Task SyncAsync(RivalStatsLeague league, CancellationToken cancellationToken)
        {
            var data = await loader.LoadAsync(league, cancellationToken);
            if (data is null) return;

            var now = timeProvider.GetUtcNow().UtcDateTime;
            var today = DateOnly.FromDateTime(now);
            var calendar = data.Input.Calendar;
            var existing = await db.RffmRoundSimulations
                .Where(s => s.GroupCode == league.GroupCode)
                .ToDictionaryAsync(s => s.Round, cancellationToken);

            foreach (var round in RoundSimulationPolicy.RoundsToSimulate(calendar, today))
            {
                var roundMatches = calendar.Where(m => m.Round == round).ToList();
                var hasStarted = RoundSimulationPolicy.Status(roundMatches, today) != RoundStatus.Upcoming;
                existing.TryGetValue(round, out var simulation);

                var isOutdatedBackfill = simulation is { IsBackfilled: true } && simulation.ModelVersion < SeasonSimulator.ModelVersion;
                if (isOutdatedBackfill)
                {
                    simulation!.RecomputeBackfilled(Simulate(data, round, ignoreCurrentInvolvement: true), SeasonSimulator.ModelVersion, now);
                    continue;
                }

                if (simulation?.IsFrozen == true)
                    continue;

                if (hasStarted && simulation is not null)
                {
                    simulation.Freeze(now);
                    continue;
                }

                var simulationData = Simulate(data, round, ignoreCurrentInvolvement: hasStarted);
                if (simulation is null)
                {
                    simulation = RffmRoundSimulation.Create(league.GroupCode, league.SeasonId, round, simulationData,
                        SeasonSimulator.ModelVersion, isBackfilled: hasStarted, now);
                    db.RffmRoundSimulations.Add(simulation);
                }
                else
                {
                    simulation.Replace(simulationData, SeasonSimulator.ModelVersion, now);
                }

                if (hasStarted) simulation.Freeze(now);
            }

            try
            {
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException)
            {
                // Otra petición concurrente guardó las mismas jornadas (índice único grupo + jornada).
            }
        }

        private static RoundSimulationData Simulate(RivalSimulationData data, int round, bool ignoreCurrentInvolvement)
        {
            var result = SeasonSimulator.Run(SimulationAsOf.AsOfRound(data.Input, round, ignoreCurrentInvolvement));
            var matches = result.Predictions
                .Where(p => p.Match.Round == round)
                .Select(p => RivalSimulationMapper.ToMatchResponse(p, data.Teams))
                .ToList();
            var standings = result.Standings
                .Select(s => RivalSimulationMapper.ToStandingResponse(s, data.Teams[s.TeamCode]))
                .ToList();

            return new RoundSimulationData(result.PlayedMatches, data.UsesSquadStrength,
                JsonSerializer.Serialize(matches, JsonOptions), JsonSerializer.Serialize(standings, JsonOptions));
        }
    }
}
