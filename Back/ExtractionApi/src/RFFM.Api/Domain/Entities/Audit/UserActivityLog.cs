using RFFM.Api.Domain.Entities.Audit;

namespace RFFM.Api.Domain.Entities.Audit
{
    /// <summary>
    /// Immutable record of an audited user action (openspec change user-activity-audit-log).
    /// No FK navigation properties to Club/Team/AspNetUsers by design (design.md Decision 8) —
    /// an audit trail must remain readable even if the entity it references is later deleted.
    /// </summary>
    public class UserActivityLog : BaseEntity, IAggregateRoot
    {
        public string UserId { get; private set; } = null!;
        public string RoleName { get; private set; } = null!;
        public string? ClubId { get; private set; }
        public string? TeamId { get; private set; }
        public DateTime Timestamp { get; private set; }
        public string? IpAddress { get; private set; }
        public string EventType { get; private set; } = null!;
        public string ActionOrPage { get; private set; } = null!;
        public string Result { get; private set; } = null!;
        public string? Reason { get; private set; }
        public string? SubjectId { get; private set; }

        private UserActivityLog() { }

        public static UserActivityLog Create(
            string userId, string roleName, string? clubId, string? teamId, string? ipAddress,
            AuditEventType eventType, string actionOrPage, string result, string? reason, string? subjectId)
        {
            if (string.IsNullOrWhiteSpace(userId))
                throw new ArgumentException("userId es obligatorio.", nameof(userId));
            if (string.IsNullOrWhiteSpace(roleName))
                throw new ArgumentException("roleName es obligatorio.", nameof(roleName));
            if (string.IsNullOrWhiteSpace(actionOrPage))
                throw new ArgumentException("actionOrPage es obligatorio.", nameof(actionOrPage));
            if (string.IsNullOrWhiteSpace(result))
                throw new ArgumentException("result es obligatorio.", nameof(result));
            if (eventType == AuditEventType.ConvocationRejected && string.IsNullOrWhiteSpace(reason))
                throw new ArgumentException("reason es obligatorio al rechazar una convocatoria.", nameof(reason));

            return new UserActivityLog
            {
                UserId = userId,
                RoleName = roleName,
                ClubId = clubId,
                TeamId = teamId,
                Timestamp = DateTime.UtcNow,
                IpAddress = ipAddress,
                EventType = eventType.Name,
                ActionOrPage = actionOrPage,
                Result = result,
                Reason = reason,
                SubjectId = subjectId
            };
        }
    }
}
