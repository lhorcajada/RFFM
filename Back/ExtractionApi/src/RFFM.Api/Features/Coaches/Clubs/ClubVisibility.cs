using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Clubs
{
    public static class ClubVisibility
    {
        public static IQueryable<Club> VisibleTo(this IQueryable<Club> clubs, AppDbContext db, string? userId)
        {
            if (string.IsNullOrEmpty(userId))
                return clubs.Where(club => club.SpaceType == SpaceType.Club);

            return clubs.Where(club =>
                club.SpaceType == SpaceType.Club ||
                db.UserClubs.Any(uc => uc.ApplicationUserId == userId && uc.ClubId == club.Id));
        }
    }
}
