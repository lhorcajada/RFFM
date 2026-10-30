namespace RFFM.Api.Domain.Entities.Teams
{
    /// <summary>Movimiento del libro del monedero (solo se añaden; nunca se editan ni se borran).</summary>
    public class QuinielaWalletMovement : BaseEntity
    {
        public string WalletId { get; private set; } = null!;
        /// <summary>Importe con signo: positivo suma al saldo, negativo resta.</summary>
        public decimal Amount { get; private set; }
        public QuinielaWalletMovementType Type { get; private set; } = null!;
        public DateTime OccurredAt { get; private set; }
        public string? Description { get; private set; }
        public string? TicketId { get; private set; }
        public string? CreatedByUserId { get; private set; }

        private QuinielaWalletMovement() { }

        internal static QuinielaWalletMovement Create(string walletId, decimal amount, QuinielaWalletMovementType type,
            DateTime nowUtc, string? description = null, string? ticketId = null, string? createdByUserId = null) => new()
        {
            WalletId = walletId,
            Amount = amount,
            Type = type,
            OccurredAt = nowUtc.Kind == DateTimeKind.Utc ? nowUtc : DateTime.SpecifyKind(nowUtc, DateTimeKind.Utc),
            Description = description,
            TicketId = ticketId,
            CreatedByUserId = createdByUserId
        };
    }
}
