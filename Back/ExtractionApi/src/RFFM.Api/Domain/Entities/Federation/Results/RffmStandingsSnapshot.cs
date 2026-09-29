using Ardalis.SmartEnum;

namespace RFFM.Api.Domain.Entities.Federation.Results
{
    public sealed class StandingsSource : SmartEnum<StandingsSource>
    {
        public static readonly StandingsSource Computed = new(nameof(Computed), 1);
        public static readonly StandingsSource Official = new(nameof(Official), 2);

        private StandingsSource(string name, int value) : base(name, value)
        {
        }
    }

    /// <summary>Clasificación del grupo tras una jornada.</summary>
    public class RffmStandingsSnapshot : BaseEntity
    {
        public string GroupCode { get; private set; } = null!;
        public int Round { get; private set; }
        /// <summary>Clasificación en formato de respuesta (jsonb).</summary>
        public string PayloadJson { get; private set; } = null!;
        public StandingsSource Source { get; private set; } = null!;
        public DateTime ComputedAt { get; private set; }

        private RffmStandingsSnapshot() { }

        public static RffmStandingsSnapshot Create(string groupCode, int round, string payloadJson, StandingsSource source, DateTime now)
        {
            if (string.IsNullOrWhiteSpace(groupCode))
                throw new ArgumentException("El grupo es obligatorio.");

            var snapshot = new RffmStandingsSnapshot { GroupCode = groupCode.Trim(), Round = round };
            snapshot.Replace(payloadJson, source, now);
            return snapshot;
        }

        public void Replace(string payloadJson, StandingsSource source, DateTime now)
        {
            if (string.IsNullOrWhiteSpace(payloadJson))
                throw new ArgumentException("La clasificación es obligatoria.");

            PayloadJson = payloadJson;
            Source = source;
            ComputedAt = now;
        }
    }
}
