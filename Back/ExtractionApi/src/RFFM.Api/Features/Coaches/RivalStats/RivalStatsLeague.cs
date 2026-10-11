using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.RivalStats
{
    public static class RivalStatsConstants
    {
        public const string Feature = "RivalStats";
        public const string TeamNotFoundCode = "TeamNotFound";
        public const string TeamWithoutCompetitionCode = "TeamWithoutRffmCompetition";
    }

    /// <summary>Liga RFFM (temporada actual + competición + grupo) del equipo de Coach y su código de equipo.</summary>
    public record RivalStatsLeague(int SeasonId, string CompetitionCode, string GroupCode, string? OwnTeamCode)
    {
        public static async Task<RivalStatsLeague> ResolveAsync(AppDbContext appDb, string teamId, RffmOptions options,
            CancellationToken cancellationToken)
        {
            var team = await appDb.Teams
                .AsNoTracking()
                .Where(t => t.Id == teamId)
                .Select(t => new { t.RffmCompetitionId, t.RffmGroupId, t.RffmTeamCode })
                .FirstOrDefaultAsync(cancellationToken);

            if (team == null)
                throw new NotFoundException("El equipo no existe.", RivalStatsConstants.TeamNotFoundCode);

            var hasLeague = team.RffmCompetitionId.HasValue && team.RffmGroupId.HasValue;
            if (!hasLeague)
                throw new ConflictException("El equipo no tiene una competición RFFM configurada.",
                    RivalStatsConstants.TeamWithoutCompetitionCode);

            return new RivalStatsLeague(options.CurrentSeasonId, team.RffmCompetitionId!.Value.ToString(),
                team.RffmGroupId!.Value.ToString(), team.RffmTeamCode);
        }
    }
}
