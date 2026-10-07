namespace RFFM.Api.Domain.Entities.Teams
{
    /// <summary>
    /// Taco de lotería entregado a un jugador. Solo guarda el dinero devuelto: las papeletas vendidas,
    /// las sobrantes y el rango se calculan con la configuración de la campaña.
    /// See openspec/changes/team-lottery/design.md → D1.
    /// </summary>
    public class LotteryBook : BaseEntity
    {
        public string LotteryCampaignId { get; private set; } = null!;
        public string TeamPlayerId { get; private set; } = null!;
        public int BookNumber { get; private set; }
        public int FirstTicketNumber { get; private set; }
        public DateOnly DeliveredOn { get; private set; }
        public DateOnly? ReturnedOn { get; private set; }
        public decimal? AmountReturned { get; private set; }

        public bool IsReturned => AmountReturned is not null;

        private LotteryBook() { }

        internal static LotteryBook Create(string campaignId, string teamPlayerId, int bookNumber, int firstTicketNumber, DateOnly deliveredOn)
        {
            var book = new LotteryBook { LotteryCampaignId = campaignId };
            book.Set(teamPlayerId, bookNumber, firstTicketNumber, deliveredOn);
            return book;
        }

        internal void Set(string teamPlayerId, int bookNumber, int firstTicketNumber, DateOnly deliveredOn)
        {
            if (string.IsNullOrWhiteSpace(teamPlayerId))
                throw new ArgumentException("teamPlayerId cannot be empty.", nameof(teamPlayerId));
            if (bookNumber <= 0)
                throw new ArgumentOutOfRangeException(nameof(bookNumber));
            if (firstTicketNumber < 0)
                throw new ArgumentOutOfRangeException(nameof(firstTicketNumber));

            TeamPlayerId = teamPlayerId;
            BookNumber = bookNumber;
            FirstTicketNumber = firstTicketNumber;
            DeliveredOn = deliveredOn;
        }

        internal void Return(decimal amount, DateOnly returnedOn)
        {
            AmountReturned = amount;
            ReturnedOn = returnedOn;
        }

        internal void UndoReturn()
        {
            AmountReturned = null;
            ReturnedOn = null;
        }
    }
}
