using Ardalis.SmartEnum;

namespace RFFM.Api.Domain.Entities.Federation.LeagueSquadStats
{
    public sealed class LeagueSquadStatsStatus : SmartEnum<LeagueSquadStatsStatus>
    {
        public static readonly LeagueSquadStatsStatus Pending = new(nameof(Pending), 1);
        public static readonly LeagueSquadStatsStatus Running = new(nameof(Running), 2);
        public static readonly LeagueSquadStatsStatus Completed = new(nameof(Completed), 3);
        public static readonly LeagueSquadStatsStatus Failed = new(nameof(Failed), 4);

        private LeagueSquadStatsStatus(string name, int value) : base(name, value)
        {
        }
    }

    public record LeagueSquadPlayerData(string PlayerCode, string PlayerName);

    public record LeagueSquadTeamData(string TeamCode, string TeamName, string? ShieldUrl, IReadOnlyList<LeagueSquadPlayerData> Players);

    public record LeagueSquadStatsRecipient(string UserId, string TeamId);

    /// <summary>
    /// Estadísticas de las plantillas de una liga (temporada + competición + grupo RFFM), compartidas
    /// entre todos los equipos de Coach que la juegan. Las estadísticas de cada jugador viven en
    /// <see cref="RffmPlayerSeasonStats"/>; aquí solo se guarda qué jugadores hay en cada equipo.
    /// </summary>
    public class LeagueSquadStatsReport : BaseEntity
    {
        public static class Rules
        {
            public const int CodeMaxLength = 50;
            public const int ErrorMessageMaxLength = 1000;
        }

        private readonly List<LeagueSquadTeam> _teams = new();
        private readonly List<LeagueSquadStatsSubscriber> _subscribers = new();

        public int SeasonId { get; private set; }
        public int? PreviousSeasonId { get; private set; }
        public string CompetitionCode { get; private set; } = null!;
        public string GroupCode { get; private set; } = null!;
        public LeagueSquadStatsStatus Status { get; private set; } = null!;
        public int TotalPlayers { get; private set; }
        public int ProcessedPlayers { get; private set; }
        public int FailedPlayers { get; private set; }
        public DateTime CreatedAt { get; private set; }
        public DateTime RequestedAt { get; private set; }
        public DateTime? StartedAt { get; private set; }
        /// <summary>Fin de la última generación correcta.</summary>
        public DateTime? CompletedAt { get; private set; }
        public string? ErrorMessage { get; private set; }

        public IReadOnlyCollection<LeagueSquadTeam> Teams => _teams.AsReadOnly();
        public IReadOnlyCollection<LeagueSquadStatsSubscriber> Subscribers => _subscribers.AsReadOnly();

        public bool IsInProgress => Status == LeagueSquadStatsStatus.Pending || Status == LeagueSquadStatsStatus.Running;

        private LeagueSquadStatsReport() { }

        public static LeagueSquadStatsReport Create(int seasonId, int? previousSeasonId, string competitionCode, string groupCode, DateTime now)
        {
            if (string.IsNullOrWhiteSpace(competitionCode))
                throw new ArgumentException("La competición es obligatoria.");
            if (string.IsNullOrWhiteSpace(groupCode))
                throw new ArgumentException("El grupo es obligatorio.");

            return new LeagueSquadStatsReport
            {
                SeasonId = seasonId,
                PreviousSeasonId = previousSeasonId,
                CompetitionCode = competitionCode.Trim(),
                GroupCode = groupCode.Trim(),
                Status = LeagueSquadStatsStatus.Pending,
                CreatedAt = now,
                RequestedAt = now
            };
        }

        /// <summary>El usuario espera un aviso cuando termine la generación en curso.</summary>
        public void Subscribe(string userId, string teamId)
        {
            if (string.IsNullOrWhiteSpace(userId))
                throw new ArgumentException("El usuario es obligatorio.");
            if (string.IsNullOrWhiteSpace(teamId))
                throw new ArgumentException("El equipo es obligatorio.");

            var existing = _subscribers.FirstOrDefault(s => s.UserId == userId);
            if (existing != null)
            {
                existing.AwaitNotification(teamId);
                return;
            }

            _subscribers.Add(LeagueSquadStatsSubscriber.Create(userId, teamId));
        }

        public IReadOnlyList<LeagueSquadStatsRecipient> TakePendingNotifications()
        {
            var pending = _subscribers.Where(s => !s.Notified).ToList();
            pending.ForEach(s => s.MarkNotified());
            return pending.Select(s => new LeagueSquadStatsRecipient(s.UserId, s.TeamId)).ToList();
        }

        public DateTime? NextRefreshAllowedAt(TimeSpan minInterval)
        {
            var isThrottled = Status == LeagueSquadStatsStatus.Completed && CompletedAt.HasValue;
            return isThrottled ? CompletedAt!.Value.Add(minInterval) : null;
        }

        public bool CanRefresh(DateTime now, TimeSpan minInterval)
        {
            if (IsInProgress)
                return false;

            var nextAllowedAt = NextRefreshAllowedAt(minInterval);
            return nextAllowedAt == null || now >= nextAllowedAt.Value;
        }

        /// <returns>true si el informe debe encolarse de nuevo.</returns>
        public bool RequestRefresh(DateTime now)
        {
            if (IsInProgress)
                return false;

            Status = LeagueSquadStatsStatus.Pending;
            RequestedAt = now;
            ErrorMessage = null;
            return true;
        }

        public void Start(DateTime now)
        {
            Status = LeagueSquadStatsStatus.Running;
            StartedAt = now;
            TotalPlayers = 0;
            ProcessedPlayers = 0;
            FailedPlayers = 0;
            ErrorMessage = null;
        }

        public void SetTotals(int totalPlayers) => TotalPlayers = totalPlayers;

        public void RegisterPlayerProcessed(bool failed)
        {
            ProcessedPlayers++;
            if (failed) FailedPlayers++;
        }

        public void ReplaceSquads(IEnumerable<LeagueSquadTeamData> teams)
        {
            _teams.Clear();
            _teams.AddRange(teams.Select(LeagueSquadTeam.Create));
        }

        public void Complete(DateTime now)
        {
            Status = LeagueSquadStatsStatus.Completed;
            CompletedAt = now;
            ErrorMessage = null;
        }

        /// <summary>Conserva los equipos y la fecha de la última generación correcta.</summary>
        public void Fail(string reason)
        {
            Status = LeagueSquadStatsStatus.Failed;
            ErrorMessage = string.IsNullOrEmpty(reason) || reason.Length <= Rules.ErrorMessageMaxLength
                ? reason
                : reason[..Rules.ErrorMessageMaxLength];
        }
    }

    public class LeagueSquadTeam : BaseEntity
    {
        public static class Rules
        {
            public const int TeamCodeMaxLength = 50;
            public const int TeamNameMaxLength = 256;
            public const int ShieldUrlMaxLength = 1024;
        }

        private readonly List<LeagueSquadPlayer> _players = new();

        public string ReportId { get; private set; } = null!;
        public string TeamCode { get; private set; } = null!;
        public string TeamName { get; private set; } = null!;
        public string? ShieldUrl { get; private set; }

        public IReadOnlyCollection<LeagueSquadPlayer> Players => _players.AsReadOnly();

        private LeagueSquadTeam() { }

        internal static LeagueSquadTeam Create(LeagueSquadTeamData data)
        {
            var team = new LeagueSquadTeam
            {
                TeamCode = data.TeamCode.Trim(),
                TeamName = (data.TeamName ?? string.Empty).Trim(),
                ShieldUrl = string.IsNullOrWhiteSpace(data.ShieldUrl) ? null : data.ShieldUrl.Trim()
            };
            team._players.AddRange(data.Players.Select(LeagueSquadPlayer.Create));
            return team;
        }
    }

    public class LeagueSquadPlayer : BaseEntity
    {
        public static class Rules
        {
            public const int PlayerCodeMaxLength = 50;
            public const int PlayerNameMaxLength = 256;
        }

        public string LeagueSquadTeamId { get; private set; } = null!;
        public string PlayerCode { get; private set; } = null!;
        public string PlayerName { get; private set; } = null!;

        private LeagueSquadPlayer() { }

        internal static LeagueSquadPlayer Create(LeagueSquadPlayerData data) => new()
        {
            PlayerCode = data.PlayerCode.Trim(),
            PlayerName = (data.PlayerName ?? string.Empty).Trim()
        };
    }

    public class LeagueSquadStatsSubscriber : BaseEntity
    {
        public string ReportId { get; private set; } = null!;
        public string UserId { get; private set; } = null!;
        /// <summary>Equipo de Coach desde el que se pidió: destino del enlace de la notificación.</summary>
        public string TeamId { get; private set; } = null!;
        public bool Notified { get; private set; }

        private LeagueSquadStatsSubscriber() { }

        internal static LeagueSquadStatsSubscriber Create(string userId, string teamId) => new() { UserId = userId, TeamId = teamId };

        internal void AwaitNotification(string teamId)
        {
            TeamId = teamId;
            Notified = false;
        }

        internal void MarkNotified() => Notified = true;
    }
}
