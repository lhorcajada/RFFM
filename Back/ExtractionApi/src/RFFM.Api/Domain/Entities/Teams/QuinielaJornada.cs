namespace RFFM.Api.Domain.Entities.Teams
{
    /// <summary>
    /// Quiniela de un equipo para una jornada RFFM. Único por (TeamId, RffmRoundId).
    /// See openspec/changes/quiniela-team-pool/design.md → D1.
    /// </summary>
    public class QuinielaJornada : BaseEntity
    {
        private const string Title = "Quiniela";

        public string TeamId { get; private set; } = null!;
        public string RffmRoundId { get; private set; } = null!;
        public decimal Price { get; private set; }
        public decimal PrizePercent { get; private set; }
        public decimal CarryIn { get; private set; }
        public QuinielaJornadaStatus Status { get; private set; } = QuinielaJornadaStatus.Open;
        public DateTime? SettledAt { get; private set; }
        public decimal? CarryOut { get; private set; }

        /// <summary>xmin de PostgreSQL como token de concurrencia: evita liquidar dos veces la misma jornada.</summary>
        public uint Version { get; private set; }

        private QuinielaJornada() { }

        public static QuinielaJornada Create(string teamId, string rffmRoundId, decimal carryIn, decimal price,
            decimal prizePercent)
        {
            if (string.IsNullOrWhiteSpace(teamId))
                throw new ArgumentException("teamId cannot be empty.", nameof(teamId));
            if (string.IsNullOrWhiteSpace(rffmRoundId))
                throw new ArgumentException("rffmRoundId cannot be empty.", nameof(rffmRoundId));

            var invalidAmounts = price <= 0 || prizePercent is < 0 or > 100 || carryIn < 0;
            if (invalidAmounts)
                throw new DomainException(Title,
                    "El precio debe ser mayor que 0, el porcentaje de premios estar entre 0 y 100 y el bote arrastrado no puede ser negativo.",
                    ErrorCodes.QuinielaInvalidJornada);

            return new QuinielaJornada
            {
                TeamId = teamId,
                RffmRoundId = rffmRoundId,
                Price = price,
                PrizePercent = prizePercent,
                CarryIn = carryIn
            };
        }

        /// <param name="firstValidKickoffUtc">Inicio del primer partido válido, o null si ninguno tiene horario.</param>
        public void EnsurePicksOpen(DateTime? firstValidKickoffUtc, DateTime nowUtc)
        {
            if (Status == QuinielaJornadaStatus.Settled)
                throw new DomainException(Title, "La quiniela de esta jornada ya está liquidada.", ErrorCodes.QuinielaPicksClosed);

            var started = firstValidKickoffUtc is { } kickoff && nowUtc >= kickoff;
            if (started)
                throw new DomainException(Title, "Los pronósticos están cerrados: ya ha empezado el primer partido.", ErrorCodes.QuinielaPicksClosed);
        }

        public void ApplyPrizePercent(decimal prizePercent)
        {
            if (Status == QuinielaJornadaStatus.Settled)
                throw new DomainException(Title, "La quiniela de esta jornada ya está liquidada.", ErrorCodes.QuinielaAlreadySettled);
            if (prizePercent is < 0 or > 100)
                throw new DomainException(Title, "El porcentaje de premios debe estar entre 0 y 100.", ErrorCodes.QuinielaInvalidJornada);

            PrizePercent = prizePercent;
        }

        public void Settle(decimal carryOut, DateTime settledAtUtc)
        {
            if (Status == QuinielaJornadaStatus.Settled)
                throw new DomainException(Title, "La quiniela de esta jornada ya está liquidada.", ErrorCodes.QuinielaAlreadySettled);
            if (carryOut < 0)
                throw new DomainException(Title, "El bote que pasa a la siguiente jornada no puede ser negativo.", ErrorCodes.QuinielaInvalidJornada);

            Status = QuinielaJornadaStatus.Settled;
            CarryOut = carryOut;
            SettledAt = settledAtUtc;
        }
    }
}
