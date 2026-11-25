namespace RFFM.Api.Domain.Entities.Teams
{
    /// <summary>
    /// Campaña de lotería de un equipo: configuración del sorteo y tacos que avanzan por los pasos de
    /// <see cref="LotteryBookStatus"/> hasta su entrega al club.
    /// </summary>
    public class LotteryCampaign : BaseEntity
    {
        private const string Title = "Lotería";

        public static class Rules
        {
            public const int NameMaxLength = 100;
            public const int MaxTicketsPerBook = 100;
            public const int MaxBooksPerBatch = 200;
        }

        public string TeamId { get; private set; } = null!;
        public string Name { get; private set; } = null!;
        public DateOnly DrawDate { get; private set; }
        public decimal TicketPrice { get; private set; }
        public int TicketsPerBook { get; private set; }
        public DateOnly ClubDeliveryFrom { get; private set; }
        public DateOnly ClubDeliveryTo { get; private set; }

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
            var priceChanged = ticketPrice != TicketPrice;
            if (priceChanged && _books.Count > 0)
                throw new DomainException(Title, "No se puede cambiar el precio de la papeleta cuando ya hay tacos creados.",
                    ErrorCodes.LotteryCampaignHasBooks);

            Configure(name, drawDate, ticketPrice, ticketsPerBook, clubDeliveryFrom, clubDeliveryTo);
        }

        public void EnsureCanBeDeleted()
        {
            if (_books.Any(b => b.Status != LotteryBookStatus.Unassigned))
                throw new DomainException(Title, "No se puede eliminar una campaña con tacos asignados.", ErrorCodes.LotteryCampaignHasBooks);
        }

        public int? TicketsSold(LotteryBook book) => book.AmountReturned is { } amount ? (int)(amount / TicketPrice) : null;

        public int? TicketsUnsold(LotteryBook book) => TicketsSold(book) is { } sold ? book.TicketCount - sold : null;

        public IReadOnlyList<LotteryBook> CreateBooks(int count)
        {
            if (count < 1 || count > Rules.MaxBooksPerBatch)
                throw new DomainException(Title, $"Se pueden crear entre 1 y {Rules.MaxBooksPerBatch} tacos de una vez.",
                    ErrorCodes.LotteryInvalidBookCount);

            var nextBookNumber = _books.Count == 0 ? 1 : _books.Max(b => b.BookNumber) + 1;
            var nextFirstTicket = _books.Count == 0 ? 1 : _books.Max(b => b.LastTicketNumber) + 1;
            var created = new List<LotteryBook>(count);
            for (var i = 0; i < count; i++)
            {
                var lastTicket = nextFirstTicket + TicketsPerBook - 1;
                created.Add(LotteryBook.CreateUnassigned(Id, nextBookNumber + i, nextFirstTicket, lastTicket));
                nextFirstTicket = lastTicket + 1;
            }

            _books.AddRange(created);
            return created;
        }

        /// <summary>Asigna un jugador a un taco sin asignar; sin <paramref name="bookId"/> crea el taco ya asignado.</summary>
        public LotteryBook AssignBook(string? bookId, string teamPlayerId, int bookNumber, int firstTicketNumber, int lastTicketNumber)
        {
            var existing = bookId is null ? null : FindBook(bookId);
            EnsureBookIsUnique(existing?.Id, bookNumber, firstTicketNumber, lastTicketNumber);

            if (existing is null)
            {
                var created = LotteryBook.CreateUnassigned(Id, bookNumber, firstTicketNumber, lastTicketNumber);
                created.Assign(teamPlayerId);
                _books.Add(created);
                return created;
            }

            existing.Assign(teamPlayerId);
            existing.SetNumbers(bookNumber, firstTicketNumber, lastTicketNumber);
            return existing;
        }

        public void EditBook(string bookId, int bookNumber, int firstTicketNumber, int lastTicketNumber)
        {
            var book = FindBook(bookId);
            if (book.HasBeenDeliveredToPlayer)
                throw new DomainException(Title, "Los números del taco no se pueden cambiar una vez entregado al jugador.",
                    ErrorCodes.LotteryBookNumbersLocked);

            EnsureBookIsUnique(book.Id, bookNumber, firstTicketNumber, lastTicketNumber);
            book.SetNumbers(bookNumber, firstTicketNumber, lastTicketNumber);
        }

        /// <summary>Avanza el taco un paso: entrega al jugador, devolución (con importe) o entrega al club.</summary>
        public void AdvanceBook(string bookId, DateOnly date, decimal? amount)
        {
            var book = FindBook(bookId);
            switch (book.Status)
            {
                case LotteryBookStatus.Unassigned:
                case LotteryBookStatus.Assigned:
                    book.DeliverToPlayer(date);
                    break;
                case LotteryBookStatus.DeliveredToPlayer:
                    book.Return(ValidReturnAmount(book, amount), date);
                    break;
                case LotteryBookStatus.ReturnedToCoach:
                    book.DeliverToClub(date);
                    break;
                default:
                    throw new DomainException(Title, "El taco ya está entregado al club y no tiene más pasos.", ErrorCodes.LotteryBookNoNextStatus);
            }
        }

        /// <summary>Deshace el último paso del taco y borra solo los datos que ese paso añadió.</summary>
        public void UndoBookStatus(string bookId)
        {
            var book = FindBook(bookId);
            switch (book.Status)
            {
                case LotteryBookStatus.Assigned:
                    book.UndoAssign();
                    break;
                case LotteryBookStatus.DeliveredToPlayer:
                    book.UndoDeliverToPlayer();
                    break;
                case LotteryBookStatus.ReturnedToCoach:
                    book.UndoReturn();
                    break;
                case LotteryBookStatus.DeliveredToClub:
                    book.UndoDeliverToClub();
                    break;
                default:
                    throw new DomainException(Title, "El taco está sin asignar y no tiene pasos que deshacer.", ErrorCodes.LotteryBookNothingToUndo);
            }
        }

        public void RemoveBook(string bookId)
        {
            var book = FindBook(bookId);
            if (book.Status != LotteryBookStatus.Unassigned)
                throw new DomainException(Title, "Solo se puede eliminar un taco sin asignar. Deshaz antes sus pasos.",
                    ErrorCodes.LotteryBookNotUnassigned);

            _books.Remove(book);
        }

        private decimal ValidReturnAmount(LotteryBook book, decimal? amount)
        {
            var maxAmount = TicketPrice * book.TicketCount;
            var validAmount = amount is { } value && value >= 0 && value <= maxAmount && value % TicketPrice == 0;
            if (!validAmount)
                throw new DomainException(Title,
                    $"El dinero devuelto debe ser múltiplo de {TicketPrice:0.##} € y no superar {maxAmount:0.##} €.",
                    ErrorCodes.LotteryInvalidReturnAmount);

            return amount!.Value;
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

        private void EnsureBookIsUnique(string? bookId, int bookNumber, int firstTicketNumber, int lastTicketNumber)
        {
            LotteryBook.EnsureValidRange(firstTicketNumber, lastTicketNumber);

            var others = _books.Where(b => b.Id != bookId).ToList();
            if (others.Any(b => b.BookNumber == bookNumber))
                throw new DomainException(Title, $"El taco {bookNumber} ya existe en esta campaña.", ErrorCodes.LotteryBookNumberDuplicated);

            var overlapping = others.FirstOrDefault(b => firstTicketNumber <= b.LastTicketNumber && b.FirstTicketNumber <= lastTicketNumber);
            if (overlapping is not null)
                throw new DomainException(Title,
                    $"Las papeletas {firstTicketNumber}–{lastTicketNumber} coinciden con el taco {overlapping.BookNumber} ({overlapping.FirstTicketNumber}–{overlapping.LastTicketNumber}).",
                    ErrorCodes.LotteryTicketRangeOverlap);
        }
    }
}
