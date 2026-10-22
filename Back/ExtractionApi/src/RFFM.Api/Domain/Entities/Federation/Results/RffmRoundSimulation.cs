namespace RFFM.Api.Domain.Entities.Federation.Results
{
    public record RoundSimulationData(int PlayedMatchesUsed, bool UsesSquadStrength, string MatchesJson, string StandingsJson);

    /// <summary>
    /// Simulación de una jornada calculada antes de jugarse (solo con los resultados de las jornadas
    /// anteriores). Se recalcula hasta que la jornada empieza; desde entonces queda congelada. Las calculadas
    /// después de empezar la jornada (rellenadas a posteriori) se recalculan si cambia la versión del modelo.
    /// </summary>
    public class RffmRoundSimulation : BaseEntity
    {
        public string GroupCode { get; private set; } = null!;
        public int SeasonId { get; private set; }
        public int Round { get; private set; }
        public int PlayedMatchesUsed { get; private set; }
        public bool UsesSquadStrength { get; private set; }
        /// <summary>Predicciones de los partidos de la jornada (jsonb).</summary>
        public string MatchesJson { get; private set; } = "[]";
        /// <summary>Clasificación proyectada en ese momento (jsonb).</summary>
        public string StandingsJson { get; private set; } = "[]";
        public int ModelVersion { get; private set; }
        public bool IsBackfilled { get; private set; }
        public DateTime ComputedAt { get; private set; }
        public DateTime? FrozenAt { get; private set; }

        public bool IsFrozen => FrozenAt.HasValue;

        private RffmRoundSimulation() { }

        public static RffmRoundSimulation Create(string groupCode, int seasonId, int round, RoundSimulationData data,
            int modelVersion, bool isBackfilled, DateTime now)
        {
            if (string.IsNullOrWhiteSpace(groupCode))
                throw new ArgumentException("El grupo es obligatorio.");

            var simulation = new RffmRoundSimulation
            {
                GroupCode = groupCode.Trim(), SeasonId = seasonId, Round = round, IsBackfilled = isBackfilled
            };
            simulation.Apply(data, modelVersion, now);
            return simulation;
        }

        /// <returns>false si la simulación está congelada y no se ha cambiado.</returns>
        public bool Replace(RoundSimulationData data, int modelVersion, DateTime now)
        {
            if (IsFrozen) return false;

            Apply(data, modelVersion, now);
            return true;
        }

        /// <returns>true si era una simulación rellenada a posteriori con una versión anterior del modelo.</returns>
        public bool RecomputeBackfilled(RoundSimulationData data, int modelVersion, DateTime now)
        {
            var mustRecompute = IsBackfilled && modelVersion > ModelVersion;
            if (!mustRecompute) return false;

            Apply(data, modelVersion, now);
            return true;
        }

        public void Freeze(DateTime now) => FrozenAt ??= now;

        private void Apply(RoundSimulationData data, int modelVersion, DateTime now)
        {
            PlayedMatchesUsed = data.PlayedMatchesUsed;
            UsesSquadStrength = data.UsesSquadStrength;
            MatchesJson = data.MatchesJson;
            StandingsJson = data.StandingsJson;
            ModelVersion = modelVersion;
            ComputedAt = now;
        }
    }
}
