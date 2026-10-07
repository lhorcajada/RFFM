namespace RFFM.Api.Domain.Entities.Teams
{
    /// <summary>
    /// Campaña de lotería de un equipo: configuración del sorteo, tacos entregados a los jugadores y
    /// liquidación con el club. See openspec/changes/team-lottery/design.md → D1.
    /// </summary>
    public class LotteryCampaign : BaseEntity
    {
        private const string Title = "Lotería";

        public static class Rules
        {
            public const int NameMaxLength = 100;
            public const int MaxTicketsPerBook = 100;
        }

        public string TeamId { get; private set; } = null!;
        public string Name { get; private set; } = null!;
        public DateOnly DrawDate { get; private set; }
        public decimal TicketPrice { get; private set; }
        public int TicketsPerBook { get; private set; }
        public DateOnly ClubDeliveryFrom { get; private set; }
        public DateOnly ClubDeliveryTo { get; private set; }
        public DateOnly? ClubDeliveredOn { get; private set; }
        public decimal? ClubDeliveredAmount { get; private set; }

        private readonly List<LotteryBook> _books = new();
        public IReadOnlyCollection<LotteryBook> Books => _books.AsReadOnly();

        private LotteryCampaign() { }

        public static LotteryCampaign Create(string teamId, string name, DateOnly drawDate, decimal ticketPrice,
            int ticketsPerBook, DateOnly clubDeliveryFrom, DateOnly clubDeliveryTo)
        {
            if (string.IsNullOrWhiteSpace(teamId))
                throw new ArgumentException("teamId cannot be empty.", nameof(teamId));

            var campaign = new LotteryCampaign { TeamId = teamId };
            campaign.Configure(name, drawDate, ticketPrice, ticketsPerBook, clubDeliveryFrom, clubDeliveryTo);
            return campaign;
        }

        public void Update(string name, DateOnly drawDate, decimal ticketPrice, int ticketsPerBook,
            DateOnly clubDeliveryFrom, DateOnly clubDeliveryTo)
        {
            var bookSettingsChanged = ticketPrice != TicketPrice || ticketsPerBook != TicketsPerBook;
            if (bookSettingsChanged && _books.Count > 0)
                throw new DomainException(Title, "No se puede cambiar el precio ni las papeletas por taco cuando ya hay tacos entregados.",
                    ErrorCodes.LotteryCampaignHasBooks);

            Configure(name, drawDate, ticketPrice, ticketsPerBook, clubDeliveryFrom, clubDeliveryTo);
        }

        public void EnsureCanBeDeleted()
        {
            if (_books.Count > 0)
                throw new DomainException(Title, "No se puede eliminar una campaña con tacos entregados.", ErrorCodes.LotteryCampaignHasBooks);
        }

        public int LastTicketNumber(LotteryBook book) => book.FirstTicketNumber + TicketsPerBook - 1;

        public int? TicketsSold(LotteryBook book) => book.AmountReturned is { } amount ? (int)(amount / TicketPrice) : null;

        public int? TicketsUnsold(LotteryBook book) => TicketsSold(book) is { } sold ? TicketsPerBook - sold : null;

        public LotteryBook DeliverBook(string teamPlayerId, int bookNumber, int firstTicketNumber, DateOnly deliveredOn)
        {
            EnsureBookIsUnique(null, bookNumber, firstTicketNumber);
            var book = LotteryBook.Create(Id, teamPlayerId, bookNumber, firstTicketNumber, deliveredOn);
            _books.Add(book);
            return book;
        }

        public void EditBook(string bookId, string teamPlayerId, int bookNumber, int firstTicketNumber, DateOnly deliveredOn)
        {
            var book = FindBook(bookId);
            EnsureBookIsUnique(book.Id, bookNumber, firstTicketNumber);
            if (book.ReturnedOn is { } returnedOn && returnedOn < deliveredOn)
                throw new DomainException(Title, "La devolución no puede ser anterior a la entrega.", ErrorCodes.LotteryReturnBeforeDelivery);

            book.Set(teamPlayerId, bookNumber, firstTicketNumber, deliveredOn);
        }

        public void ReturnBook(string bookId, decimal amount, DateOnly returnedOn)
        {
            var book = FindBook(bookId);
            var maxAmount = TicketPrice * TicketsPerBook;
            var isMultipleOfPrice = amount % TicketPrice == 0;
            if (amount < 0 || amount > maxAmount || !isMultipleOfPrice)
                throw new DomainException(Title,
                    $"El dinero devuelto debe ser múltiplo de {TicketPrice:0.##} € y no superar {maxAmount:0.##} €.",
                    ErrorCodes.LotteryInvalidReturnAmount);
            if (returnedOn < book.DeliveredOn)
                throw new DomainException(Title, "La devolución no puede ser anterior a la entrega.", ErrorCodes.LotteryReturnBeforeDelivery);

            book.Return(amount, returnedOn);
        }

        public void UndoReturn(string bookId) => FindBook(bookId).UndoReturn();

        public void RemoveBook(string bookId)
        {
            var book = FindBook(bookId);
            if (book.IsReturned)
                throw new DomainException(Title, "No se puede eliminar un taco ya devuelto. Deshaz antes la devolución.",
                    ErrorCodes.LotteryBookAlreadyReturned);

            _books.Remove(book);
        }

        public void RecordClubDelivery(decimal amount, DateOnly deliveredOn)
        {
            if (amount < 0)
                throw new DomainException(Title, "El importe entregado al club no puede ser negativo.", ErrorCodes.LotteryInvalidClubDeliveryAmount);

            ClubDeliveredAmount = amount;
            ClubDeliveredOn = deliveredOn;
        }

        public void UndoClubDelivery()
        {
            ClubDeliveredAmount = null;
            ClubDeliveredOn = null;
        }

        private void Configure(string name, DateOnly drawDate, decimal ticketPrice, int ticketsPerBook,
            DateOnly clubDeliveryFrom, DateOnly clubDeliveryTo)
        {
            var trimmedName = name?.Trim() ?? string.Empty;
            var invalidName = trimmedName.Length == 0 || trimmedName.Length > Rules.NameMaxLength;
            var invalidBookSettings = ticketPrice <= 0 || ticketsPerBook < 1 || ticketsPerBook > Rules.MaxTicketsPerBook;
            if (invalidName || invalidBookSettings)
                throw new DomainException(Title,
                    $"La campaña necesita un nombre de hasta {Rules.NameMaxLength} caracteres, un precio mayor que 0 y entre 1 y {Rules.MaxTicketsPerBook} papeletas por taco.",
                    ErrorCodes.LotteryInvalidCampaign);

            var invalidWindow = clubDeliveryFrom > clubDeliveryTo || clubDeliveryTo > drawDate;
            if (invalidWindow)
                throw new DomainException(Title, "La entrega al club debe empezar antes de terminar y no puede acabar después del sorteo.",
                    ErrorCodes.LotteryInvalidClubDeliveryWindow);

            Name = trimmedName;
            DrawDate = drawDate;
            TicketPrice = ticketPrice;
            TicketsPerBook = ticketsPerBook;
            ClubDeliveryFrom = clubDeliveryFrom;
            ClubDeliveryTo = clubDeliveryTo;
        }

        private LotteryBook FindBook(string bookId) =>
            _books.SingleOrDefault(b => b.Id == bookId)
            ?? throw new NotFoundException($"LotteryBook '{bookId}' Not Found", ErrorCodes.LotteryBookNotFound);

        private void EnsureBookIsUnique(string? bookId, int bookNumber, int firstTicketNumber)
        {
            var others = _books.Where(b => b.Id != bookId).ToList();
            if (others.Any(b => b.BookNumber == bookNumber))
                throw new DomainException(Title, $"El taco {bookNumber} ya está entregado en esta campaña.", ErrorCodes.LotteryBookNumberDuplicated);

            var lastTicketNumber = firstTicketNumber + TicketsPerBook - 1;
            var overlapping = others.FirstOrDefault(b => firstTicketNumber <= LastTicketNumber(b) && b.FirstTicketNumber <= lastTicketNumber);
            if (overlapping is not null)
                throw new DomainException(Title,
                    $"Las papeletas {firstTicketNumber}–{lastTicketNumber} coinciden con el taco {overlapping.BookNumber} ({overlapping.FirstTicketNumber}–{LastTicketNumber(overlapping)}).",
                    ErrorCodes.LotteryTicketRangeOverlap);
        }
    }
}
