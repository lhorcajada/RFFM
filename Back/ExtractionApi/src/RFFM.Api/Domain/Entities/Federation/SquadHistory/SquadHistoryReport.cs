namespace RFFM.Api.Domain.Entities.Federation.SquadHistory
{
    public class SquadHistoryReport : BaseEntity
    {
        public static class Rules
        {
            public const int TeamCodeMaxLength = 50;
            public const int TeamNameMaxLength = 256;
            public const int ErrorMessageMaxLength = 1000;
            public const int CandidateSearchNoteMaxLength = 500;
        }

        private readonly List<SquadHistoryEntry> _entries = new();
        private readonly List<SquadHistorySubscriber> _subscribers = new();

        public string TeamCode { get; private set; } = null!;
        public string TeamName { get; private set; } = null!;
        public int SeasonId { get; private set; }
        public int? PreviousSeasonId { get; private set; }
        public SquadHistoryStatus Status { get; private set; } = null!;
        public int TotalPlayers { get; private set; }
        public int ProcessedPlayers { get; private set; }
        public int FailedPlayers { get; private set; }
        public DateTime RequestedAt { get; private set; }
        public DateTime? StartedAt { get; private set; }
        public DateTime? CompletedAt { get; private set; }
        public string? ErrorMessage { get; private set; }
        public bool IsCandidateSquad { get; private set; }
        public string? CandidateSearchNote { get; private set; }

        public IReadOnlyCollection<SquadHistoryEntry> Entries => _entries.AsReadOnly();
        public IReadOnlyCollection<SquadHistorySubscriber> Subscribers => _subscribers.AsReadOnly();

        private SquadHistoryReport() { }

        public static SquadHistoryReport Create(string teamCode, string teamName, int seasonId, int? previousSeasonId, string userId)
        {
            if (string.IsNullOrWhiteSpace(teamCode))
                throw new ArgumentException("El equipo es obligatorio.");
            if (string.IsNullOrWhiteSpace(userId))
                throw new ArgumentException("El usuario es obligatorio.");

            var report = new SquadHistoryReport
            {
                TeamCode = teamCode.Trim(),
                TeamName = (teamName ?? string.Empty).Trim(),
                SeasonId = seasonId,
                PreviousSeasonId = previousSeasonId,
                Status = SquadHistoryStatus.Pending,
                RequestedAt = DateTime.UtcNow
            };
            report.Subscribe(userId);
            return report;
        }

        public void Subscribe(string userId)
        {
            if (string.IsNullOrWhiteSpace(userId))
                throw new ArgumentException("El usuario es obligatorio.");

            var existing = _subscribers.FirstOrDefault(s => s.UserId == userId);
            if (existing != null)
            {
                existing.AwaitNotification();
                return;
            }

            _subscribers.Add(SquadHistorySubscriber.Create(userId));
        }

        /// <returns>true si el informe debe encolarse de nuevo.</returns>
        public bool RequestRefresh(string userId)
        {
            Subscribe(userId);

            var isInProgress = Status == SquadHistoryStatus.Pending || Status == SquadHistoryStatus.Running;
            if (isInProgress)
                return false;

            Status = SquadHistoryStatus.Pending;
            RequestedAt = DateTime.UtcNow;
            ErrorMessage = null;
            return true;
        }

        public void Start(int totalPlayers)
        {
            Status = SquadHistoryStatus.Running;
            StartedAt = DateTime.UtcNow;
            TotalPlayers = totalPlayers;
            ProcessedPlayers = 0;
            FailedPlayers = 0;
            IsCandidateSquad = false;
            CandidateSearchNote = null;
        }

        /// <summary>El equipo aún no tiene jugadores: el informe muestra posibles jugadores del club.</summary>
        public void MarkAsCandidateSquad(string? note)
        {
            IsCandidateSquad = true;
            CandidateSearchNote = string.IsNullOrWhiteSpace(note) ? null : Truncate(note, Rules.CandidateSearchNoteMaxLength);
        }

        public void ReportProgress(bool playerFailed)
        {
            ProcessedPlayers++;
            if (playerFailed) FailedPlayers++;
        }

        public void Complete(IEnumerable<SquadHistoryEntry> entries)
        {
            _entries.Clear();
            _entries.AddRange(entries);
            Status = SquadHistoryStatus.Completed;
            CompletedAt = DateTime.UtcNow;
            ErrorMessage = null;
        }

        public void Fail(string reason)
        {
            Status = SquadHistoryStatus.Failed;
            ErrorMessage = Truncate(reason, Rules.ErrorMessageMaxLength);
        }

        public IReadOnlyList<string> TakePendingNotifications()
        {
            var pending = _subscribers.Where(s => !s.Notified).ToList();
            pending.ForEach(s => s.MarkNotified());
            return pending.Select(s => s.UserId).ToList();
        }

        private static string Truncate(string value, int maxLength) =>
            string.IsNullOrEmpty(value) || value.Length <= maxLength ? value : value[..maxLength];
    }
}
