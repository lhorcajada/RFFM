using Microsoft.EntityFrameworkCore;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Teams
{
    public static class TeamJoinCodeGate
    {
        public static async Task<bool> ProvesTeamAsync(
            AppDbContext db, string teamId, string? joinCode, CancellationToken cancellationToken)
        {
            var normalizedCode = Normalize(joinCode);
            if (normalizedCode is null)
                return false;

            return await db.Teams
                .IgnoreQueryFilters()
                .AnyAsync(t => t.Id == teamId && t.JoinCode != null && t.JoinCode.ToUpper() == normalizedCode, cancellationToken);
        }

        private static string? Normalize(string? joinCode)
        {
            var code = (joinCode ?? string.Empty).Trim().ToUpperInvariant();
            var hasValidFormat = code.Length == ValidationConstants.TeamJoinCodeLength && code.All(char.IsAsciiLetterOrDigit);
            return hasValidFormat ? code : null;
        }
    }
}
