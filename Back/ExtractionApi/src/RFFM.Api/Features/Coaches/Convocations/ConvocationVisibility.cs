using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.SportEvents.Queries;

namespace RFFM.Api.Features.Coaches.Convocations
{
    /// <summary>
    /// League-match convocations are a draft for the coach until the coach publishes them:
    /// players and families neither see them nor get notified before that.
    /// </summary>
    internal static class ConvocationVisibility
    {
        public static bool IsLeagueMatch(SportEvent sportEvent) =>
            sportEvent.EventTypeId == SportEventsConstants.MatchEventTypeId;

        public static bool IsDraftLeagueConvocation(SportEvent sportEvent) =>
            IsLeagueMatch(sportEvent) && !sportEvent.IsConvocationPublished;

        public static bool IsPlayerOrFamilyViewer(ICurrentUserService currentUser)
        {
            var roles = (currentUser.Roles ?? Enumerable.Empty<string>()).ToArray();
            var isStaff = roles.Any(r =>
                r.Equals("Coach", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("Administrator", StringComparison.OrdinalIgnoreCase));
            var isPlayerOrFamily = roles.Any(r =>
                r.Equals("Player", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("FamilyMember", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("FamilyPlayer", StringComparison.OrdinalIgnoreCase));
            return isPlayerOrFamily && !isStaff;
        }

        public static bool IsHiddenFromViewer(SportEvent sportEvent, ICurrentUserService currentUser) =>
            IsDraftLeagueConvocation(sportEvent) && IsPlayerOrFamilyViewer(currentUser);
    }
}
