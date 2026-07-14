using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Clubs
{
    public static class ClubInvitationCodeVisibility
    {
        public static async Task<bool> CanViewAsync(
            AppDbContext db, ClaimsPrincipal user, string clubId, CancellationToken cancellationToken)
        {
            if (user.IsInRole(AppRoles.Administrator.Name))
                return true;

            var userId = GetUserId(user);
            if (string.IsNullOrEmpty(userId))
                return false;

            return await db.UserClubs.AnyAsync(uc =>
                uc.ApplicationUserId == userId &&
                uc.ClubId == clubId &&
                uc.RoleId == Membership.Directive.Id,
                cancellationToken);
        }

        public static async Task<HashSet<string>> DirectorClubIdsAsync(
            AppDbContext db, ClaimsPrincipal user, CancellationToken cancellationToken) =>
            await DirectorClubIdsAsync(db, GetUserId(user), cancellationToken);

        public static async Task<HashSet<string>> DirectorClubIdsAsync(
            AppDbContext db, string? userId, CancellationToken cancellationToken)
        {
            if (string.IsNullOrEmpty(userId))
                return new HashSet<string>();

            var clubIds = await db.UserClubs
                .Where(uc => uc.ApplicationUserId == userId && uc.RoleId == Membership.Directive.Id)
                .Select(uc => uc.ClubId)
                .ToListAsync(cancellationToken);

            return clubIds.ToHashSet();
        }

        private static string? GetUserId(ClaimsPrincipal user) =>
            user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
    }
}
