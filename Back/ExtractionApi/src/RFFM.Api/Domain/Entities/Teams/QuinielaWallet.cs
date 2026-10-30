namespace RFFM.Api.Domain.Entities.Teams
{
    /// <summary>
    /// Monedero de la quiniela de un usuario en un equipo. Único por (TeamId, ApplicationUserId); el saldo nunca es
    /// negativo y siempre es la suma de sus movimientos (libro append-only en <see cref="QuinielaWalletMovement"/>).
    /// <see cref="Version"/> se mapea a <c>xmin</c> de PostgreSQL como token de concurrencia optimista.
    /// See openspec/changes/quiniela-wallet/design.md → D1, D3.
    /// </summary>
    public class QuinielaWallet : BaseEntity, IAggregateRoot
    {
        private const string Title = "Monedero de la quiniela";

        public static class Rules
        {
            /// <summary>Importe máximo de una recarga o de un ajuste (tope de seguridad contra errores de tecleo).</summary>
            public const decimal MaxMovementAmount = 10m;
            public const int MaxDescriptionLength = 200;
        }

        public string TeamId { get; private set; } = null!;
        public string ApplicationUserId { get; private set; } = null!;
        public decimal Balance { get; private set; }
        public DateTime UpdatedAt { get; private set; }
        public uint Version { get; private set; }

        private QuinielaWallet() { }

        public static QuinielaWallet Create(string teamId, string applicationUserId)
        {
            if (string.IsNullOrWhiteSpace(teamId))
                throw new ArgumentException("teamId cannot be empty.", nameof(teamId));
            if (string.IsNullOrWhiteSpace(applicationUserId))
                throw new ArgumentException("applicationUserId cannot be empty.", nameof(applicationUserId));

            return new QuinielaWallet { TeamId = teamId, ApplicationUserId = applicationUserId, UpdatedAt = DateTime.UtcNow };
        }

        public QuinielaWalletMovement TopUp(decimal amount, string createdByUserId, string? description, DateTime nowUtc)
        {
            EnsureValidManualAmount(amount);
            return Apply(amount, QuinielaWalletMovementType.TopUp, nowUtc, description, null, createdByUserId);
        }

        /// <summary>Resta <paramref name="amount"/> (positivo) del saldo; nunca lo deja en negativo.</summary>
        public QuinielaWalletMovement Adjust(decimal amount, string createdByUserId, string reason, DateTime nowUtc)
        {
            EnsureValidManualAmount(amount);
            if (string.IsNullOrWhiteSpace(reason))
                throw new DomainException(Title, "Indica el motivo del ajuste.", ErrorCodes.QuinielaWalletInvalidAmount);
            if (amount > Balance)
                throw new ConflictException($"El saldo ({Balance:0.00} €) no cubre el ajuste de {amount:0.00} €.", ErrorCodes.QuinielaWalletInsufficientBalance);

            return Apply(-amount, QuinielaWalletMovementType.Adjustment, nowUtc, reason, null, createdByUserId);
        }

        /// <summary>Cobra el boleto todo o nada: devuelve null y no cambia nada si el saldo no cubre el precio.</summary>
        public QuinielaWalletMovement? TryChargeTicket(string ticketId, decimal price, DateTime nowUtc)
        {
            if (price <= 0m || price > Balance)
                return null;

            return Apply(-price, QuinielaWalletMovementType.TicketCharge, nowUtc, null, ticketId, null);
        }

        public QuinielaWalletMovement RefundTicket(string ticketId, decimal amount, DateTime nowUtc)
        {
            if (amount <= 0m)
                throw new DomainException(Title, "El importe del reembolso debe ser mayor que 0.", ErrorCodes.QuinielaWalletInvalidAmount);

            return Apply(amount, QuinielaWalletMovementType.TicketRefund, nowUtc, null, ticketId, null);
        }

        private static void EnsureValidManualAmount(decimal amount)
        {
            var invalid = amount <= 0m || amount > Rules.MaxMovementAmount || decimal.Round(amount, 2) != amount;
            if (invalid)
                throw new DomainException(Title,
                    $"El importe debe ser mayor que 0, con dos decimales como máximo y no superar {Rules.MaxMovementAmount:0.00} €.",
                    ErrorCodes.QuinielaWalletInvalidAmount);
        }

        private QuinielaWalletMovement Apply(decimal signedAmount, QuinielaWalletMovementType type, DateTime nowUtc,
            string? description, string? ticketId, string? createdByUserId)
        {
            Balance += signedAmount;
            UpdatedAt = nowUtc;
            return QuinielaWalletMovement.Create(Id, signedAmount, type, nowUtc, description, ticketId, createdByUserId);
        }
    }
}
