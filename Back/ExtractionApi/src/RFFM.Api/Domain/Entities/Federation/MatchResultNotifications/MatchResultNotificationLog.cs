namespace RFFM.Api.Domain.Entities.Federation.MatchResultNotifications
{
    /// <summary>Resultado ya notificado a un usuario: garantiza un único aviso por usuario y partido.</summary>
    public class MatchResultNotificationLog : BaseEntity
    {
        public static class Rules
        {
            public const int UserIdMaxLength = 450;
            public const int RecordCodeMaxLength = 100;
            public const int TeamCodeMaxLength = 100;
            public const int GoalsMaxLength = 10;
        }

        public string UserId { get; private set; } = null!;
        public string RecordCode { get; private set; } = null!;
        public string TeamCode { get; private set; } = null!;
        public string LocalGoals { get; private set; } = null!;
        public string VisitorGoals { get; private set; } = null!;
        public DateTime NotifiedAt { get; private set; }

        private MatchResultNotificationLog() { }

        public static MatchResultNotificationLog Create(string userId, string recordCode, string teamCode,
            string localGoals, string visitorGoals, DateTime now)
        {
            if (string.IsNullOrWhiteSpace(userId))
                throw new ArgumentException("El usuario es obligatorio.");
            if (string.IsNullOrWhiteSpace(recordCode))
                throw new ArgumentException("El partido es obligatorio.");
            if (string.IsNullOrWhiteSpace(teamCode))
                throw new ArgumentException("El equipo es obligatorio.");

            return new MatchResultNotificationLog
            {
                UserId = userId,
                RecordCode = recordCode.Trim(),
                TeamCode = teamCode.Trim(),
                LocalGoals = localGoals.Trim(),
                VisitorGoals = visitorGoals.Trim(),
                NotifiedAt = now
            };
        }
    }
}
