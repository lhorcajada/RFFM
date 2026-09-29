namespace RFFM.Api.Domain.Entities.Federation.Results
{
    /// <summary>Acta completa de un partido cerrado (alineaciones, goles, tarjetas, cambios, técnicos, árbitros).</summary>
    public class RffmMatchRecord : BaseEntity
    {
        public string RecordCode { get; private set; } = null!;
        public string GroupCode { get; private set; } = null!;
        /// <summary>Acta tal como la devuelve la RFFM (jsonb).</summary>
        public string PayloadJson { get; private set; } = null!;
        public DateTime FetchedAt { get; private set; }

        private RffmMatchRecord() { }

        public static RffmMatchRecord Create(string recordCode, string groupCode, string payloadJson, DateTime now)
        {
            if (string.IsNullOrWhiteSpace(recordCode))
                throw new ArgumentException("El acta es obligatoria.");
            if (string.IsNullOrWhiteSpace(payloadJson))
                throw new ArgumentException("El contenido del acta es obligatorio.");

            return new RffmMatchRecord
            {
                RecordCode = recordCode.Trim(),
                GroupCode = (groupCode ?? string.Empty).Trim(),
                PayloadJson = payloadJson,
                FetchedAt = now
            };
        }
    }
}
