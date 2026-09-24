using Microsoft.AspNetCore.Http;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Audit;
using RFFM.Api.Domain.Services;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Infrastructure.Services
{
    public class AuditLogger : IAuditLogger
    {
        private readonly AppDbContext _db;
        private readonly ICurrentUserService _currentUser;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public AuditLogger(AppDbContext db, ICurrentUserService currentUser, IHttpContextAccessor httpContextAccessor)
        {
            _db = db;
            _currentUser = currentUser;
            _httpContextAccessor = httpContextAccessor;
        }

        public Task LogAsync(
            AuditEventType eventType, string actionOrPage, string result,
            string? reason = null, string? subjectId = null, string? clubId = null, string? teamId = null,
            string? roleNameOverride = null, CancellationToken cancellationToken = default)
        {
            // Administrators are never audit subjects, regardless of what other roles they also hold.
            var isAdministrator = (_currentUser.Roles ?? Enumerable.Empty<string>())
                .Any(r => r.Equals(AppRoles.Administrator.Name, StringComparison.OrdinalIgnoreCase));
            if (isAdministrator)
                return Task.CompletedTask;

            var roleName = roleNameOverride ?? _currentUser.Role ?? "unknown";
            if (roleName.Equals(AppRoles.Coach.Name, StringComparison.OrdinalIgnoreCase))
                return Task.CompletedTask;

            var userId = _currentUser.UserId ?? "unknown";
            var ipAddress = ResolveClientIp(_httpContextAccessor.HttpContext);

            var log = UserActivityLog.Create(
                userId, roleName, clubId, teamId, ipAddress, eventType, actionOrPage, result, reason, subjectId);

            _db.UserActivityLogs.Add(log);
            return Task.CompletedTask;
        }

        private static string? ResolveClientIp(HttpContext? ctx)
        {
            if (ctx is null) return null;

            var forwardedFor = ctx.Request.Headers["X-Forwarded-For"].FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(forwardedFor))
                return forwardedFor.Split(',')[0].Trim();

            return ctx.Connection.RemoteIpAddress?.ToString();
        }
    }
}
