using RFFM.Api.Domain.Entities.Federation;

namespace RFFM.Api.Features.Federation.MatchResultNotifications
{
    /// <summary>
    /// «Su equipo» = combinación principal de la temporada actual con equipo y grupo (la misma que resalta
    /// el partido en MatchCard). Una combinación sin temporada se trata como de la actual, igual que en el front.
    /// </summary>
    public static class PrimaryTeamSettings
    {
        public static IQueryable<FederationSetting> CurrentPrimaryTeams(this IQueryable<FederationSetting> settings,
            int currentSeasonId) =>
            settings.Where(s => s.IsPrimary
                                && s.TeamId != null && s.TeamId != ""
                                && s.GroupId != null && s.GroupId != ""
                                && (s.SeasonId == null || s.SeasonId == currentSeasonId));
    }
}
