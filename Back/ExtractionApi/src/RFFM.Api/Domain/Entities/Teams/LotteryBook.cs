namespace RFFM.Api.Domain.Entities.Teams
{
    /// <summary>
    /// Taco de lotería: papeletas consecutivas que se asignan a un jugador y avanzan por los pasos de
    /// <see cref="LotteryBookStatus"/>. Guarda su rango y los datos de cada paso; las papeletas vendidas se calculan
    /// con el precio de la campaña.
    /// </summary>
    public class LotteryBook : BaseEntity
    {
        private const string Title = "Lotería";

        public string LotteryCampaignId { get; private set; } = null!;
        public string? TeamPlayerId { get; private set; }
        public int BookNumber { get; private set; }
        public int FirstTicketNumber { get; private set; }
        public int LastTicketNumber { get; private set; }
        public LotteryBookStatus Status { get; private set; }
        public DateOnly? DeliveredOn { get; private set; }
        public DateOnly? ReturnedOn { get; private set; }
        public decimal? AmountReturned { get; private set; }
        public DateOnly? ClubDeliveredOn { get; private set; }

        public int TicketCount => LastTicketNumber - FirstTicketNumber + 1;

        public bool HasBeenDeliveredToPlayer => Status >= LotteryBookStatus.DeliveredToPlayer;

        public bool HasBeenReturned => Status >= LotteryBookStatus.ReturnedToCoach;

        private LotteryBook() { }

        internal static LotteryBook CreateUnassigned(string campaignId, int bookNumber, int firstTicketNumber, int lastTicketNumber)
        {
            var book = new LotteryBook { LotteryCampaignId = campaignId, Status = LotteryBookStatus.Unassigned };
            book.SetNumbers(bookNumber, firstTicketNumber, lastTicketNumber);
            return book;
        }

        internal void SetNumbers(int bookNumber, int firstTicketNumber, int lastTicketNumber)
        {
            if (bookNumber <= 0)
                throw new ArgumentOutOfRangeException(nameof(bookNumber));
            if (firstTicketNumber < 0)
                throw new ArgumentOutOfRangeException(nameof(firstTicketNumber));
            EnsureValidRange(firstTicketNumber, lastTicketNumber);

            BookNumber = bookNumber;
            FirstTicketNumber = firstTicketNumber;
            LastTicketNumber = lastTicketNumber;
        }

        internal static void EnsureValidRange(int firstTicketNumber, int lastTicketNumber)
        {
            if (lastTicketNumber < firstTicketNumber)
                throw new DomainException(Title, "La última papeleta no puede ser menor que la primera.", ErrorCodes.LotteryInvalidTicketRange);
        }

        internal void Assign(string teamPlayerId)
        {
            EnsureStatus(LotteryBookStatus.Unassigned, "El taco ya está asignado.", ErrorCodes.LotteryBookNotUnassigned);
            if (string.IsNullOrWhiteSpace(teamPlayerId))
                throw new ArgumentException("teamPlayerId cannot be empty.", nameof(teamPlayerId));

            TeamPlayerId = teamPlayerId;
            Status = LotteryBookStatus.Assigned;
        }

        internal void UndoAssign()
        {
            EnsureStatus(LotteryBookStatus.Assigned, "El taco no está en el paso de asignado.", ErrorCodes.LotteryBookNotAssigned);

            TeamPlayerId = null;
            Status = LotteryBookStatus.Unassigned;
        }

        internal void DeliverToPlayer(DateOnly deliveredOn)
        {
            EnsureStatus(LotteryBookStatus.Assigned, "El taco debe estar asignado a un jugador para entregárselo.", ErrorCodes.LotteryBookNotAssigned);

            DeliveredOn = deliveredOn;
            Status = LotteryBookStatus.DeliveredToPlayer;
        }

        internal void UndoDeliverToPlayer()
        {
            EnsureStatus(LotteryBookStatus.DeliveredToPlayer, "El taco no está entregado al jugador.", ErrorCodes.LotteryBookNotDeliveredToPlayer);

            DeliveredOn = null;
            Status = LotteryBookStatus.Assigned;
        }

        internal void Return(decimal amount, DateOnly returnedOn)
        {
            EnsureStatus(LotteryBookStatus.DeliveredToPlayer, "El taco debe estar entregado al jugador para devolverlo.", ErrorCodes.LotteryBookNotDeliveredToPlayer);
            if (returnedOn < DeliveredOn)
                throw new DomainException(Title, "La devolución no puede ser anterior a la entrega.", ErrorCodes.LotteryReturnBeforeDelivery);

            AmountReturned = amount;
            ReturnedOn = returnedOn;
            Status = LotteryBookStatus.ReturnedToCoach;
        }

        internal void UndoReturn()
        {
            EnsureStatus(LotteryBookStatus.ReturnedToCoach, "El taco no está devuelto al entrenador.", ErrorCodes.LotteryBookNotReturned);

            AmountReturned = null;
            ReturnedOn = null;
            Status = LotteryBookStatus.DeliveredToPlayer;
        }

        internal void DeliverToClub(DateOnly deliveredOn)
        {
            EnsureStatus(LotteryBookStatus.ReturnedToCoach, "El taco debe estar devuelto al entrenador para entregarlo al club.", ErrorCodes.LotteryBookNotReturned);

            ClubDeliveredOn = deliveredOn;
            Status = LotteryBookStatus.DeliveredToClub;
        }

        internal void UndoDeliverToClub()
        {
            EnsureStatus(LotteryBookStatus.DeliveredToClub, "El taco no está entregado al club.", ErrorCodes.LotteryBookNotDeliveredToClub);

            ClubDeliveredOn = null;
            Status = LotteryBookStatus.ReturnedToCoach;
        }

        private void EnsureStatus(LotteryBookStatus expected, string message, string code)
        {
            if (Status != expected)
                throw new DomainException(Title, message, code);
        }
    }
}
