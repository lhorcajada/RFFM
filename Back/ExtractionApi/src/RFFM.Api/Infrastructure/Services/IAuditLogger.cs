using RFFM.Api.Domain.Entities.Audit;

namespace RFFM.Api.Infrastructure.Services
{
    /// <summary>
    /// Emits an audit event onto the shared AppDbContext without saving — the calling handler's
    /// own SaveChangesAsync persists the audit row atomically with the change it describes
    /// (openspec change user-activity-audit-log, design.md Decision 3).
    /// </summary>
    public interface IAuditLogger
    {
        Task LogAsync(
            AuditEventType eventType, string actionOrPage, string result,
            string? reason = null, string? subjectId = null, string? clubId = null, string? teamId = null,
            string? roleNameOverride = null, CancellationToken cancellationToken = default);
    }
}
