namespace RFFM.Api.Domain.Entities.Teams
{
    /// <summary>
    /// Boleto de un participante en una quiniela. Único por (JornadaId, ApplicationUserId).
    /// El estado Expirado no se guarda: se deriva con <see cref="EffectiveStatus"/>.
    /// See openspec/changes/quiniela-team-pool/design.md → D1, D4.
    /// </summary>
    public class QuinielaTicket : BaseEntity
    {
        private const string Title = "Quiniela";

        public static class Rules
        {
            /// <summary>Goles del Pleno: 0, 1, 2 o 3 (= M, "más de dos").</summary>
            public const int MaxPlenoGoals = 3;
        }

        public string JornadaId { get; private set; } = null!;
        public string ApplicationUserId { get; private set; } = null!;
        public int PlenoHome { get; private set; }
        public int PlenoAway { get; private set; }
        public QuinielaPaymentStatus PaymentStatus { get; private set; } = QuinielaPaymentStatus.Pending;
        public DateTime? PaidAt { get; private set; }
        public QuinielaPaymentMethod? PaymentMethod { get; private set; }
        public int? Hits { get; private set; }
        public QuinielaCategory? Category { get; private set; }
        public decimal? Prize { get; private set; }

        private readonly List<QuinielaPick> _picks = new();
        public IReadOnlyCollection<QuinielaPick> Picks => _picks.AsReadOnly();

        private QuinielaTicket() { }

        public static QuinielaTicket Create(string jornadaId, string applicationUserId,
            IEnumerable<QuinielaPick> picks, int plenoHome, int plenoAway)
        {
            if (string.IsNullOrWhiteSpace(jornadaId))
                throw new ArgumentException("jornadaId cannot be empty.", nameof(jornadaId));
            if (string.IsNullOrWhiteSpace(applicationUserId))
                throw new ArgumentException("applicationUserId cannot be empty.", nameof(applicationUserId));

            var ticket = new QuinielaTicket { JornadaId = jornadaId, ApplicationUserId = applicationUserId };
            ticket.ReplacePicks(picks, plenoHome, plenoAway);
            return ticket;
        }

        public void ReplacePicks(IEnumerable<QuinielaPick> picks, int plenoHome, int plenoAway)
        {
            var newPicks = picks?.ToList() ?? [];
            var plenoOutOfRange = plenoHome is < 0 or > Rules.MaxPlenoGoals || plenoAway is < 0 or > Rules.MaxPlenoGoals;
            var invalidPicks = newPicks.Count == 0
                || newPicks.Any(p => p is null || string.IsNullOrWhiteSpace(p.RecordCode) || p.Sign is null)
                || newPicks.Select(p => p.RecordCode).Distinct().Count() != newPicks.Count;
            if (plenoOutOfRange || invalidPicks)
                throw new DomainException(Title,
                    "El boleto necesita al menos un pronóstico por partido distinto y el Pleno con goles de 0 a 2 o M.",
                    ErrorCodes.QuinielaInvalidTicket);

            _picks.Clear();
            _picks.AddRange(newPicks);
            PlenoHome = plenoHome;
            PlenoAway = plenoAway;
        }

        public void MarkPaid(QuinielaPaymentMethod method, DateTime paidAtUtc)
        {
            PaymentStatus = QuinielaPaymentStatus.Paid;
            PaymentMethod = method ?? throw new ArgumentNullException(nameof(method));
            PaidAt = paidAtUtc;
        }

        public void MarkPending()
        {
            PaymentStatus = QuinielaPaymentStatus.Pending;
            PaymentMethod = null;
            PaidAt = null;
        }

        /// <summary>Pending pasado el plazo se trata como Expired; un boleto pagado nunca expira.</summary>
        public QuinielaPaymentStatus EffectiveStatus(DateTime paymentDeadlineUtc, DateTime nowUtc) =>
            PaymentStatus == QuinielaPaymentStatus.Pending && nowUtc >= paymentDeadlineUtc
                ? QuinielaPaymentStatus.Expired
                : PaymentStatus;

        public void ApplyResult(int hits, QuinielaCategory category, decimal prize)
        {
            Hits = hits;
            Category = category;
            Prize = prize;
        }
    }
}
