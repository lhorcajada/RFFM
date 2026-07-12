using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    public static class TeamRosterQueries
    {
        public sealed record RosterPlayer(
            string TeamPlayerId,
            string PlayerId,
            string Name,
            string? LastName,
            string? UrlPhoto,
            int? Dorsal,
            bool AlreadyLinked);

        // membershipIdForUniquenessCheck: pass Membership.Player.Id to compute
        // AlreadyLinked against the "one Player-kind account per TeamPlayer"
        // rule (design.md §4); pass null (or Membership.FamilyPlayer.Id) to
        // always return AlreadyLinked = false, since FamilyPlayer sharing a
        // player is allowed.
        public static async Task<RosterPlayer[]> GetRoster(
            AppDbContext db, string teamId, int? membershipIdForUniquenessCheck, CancellationToken cancellationToken)
        {
            var items = await db.TeamPlayers
                .AsNoTracking()
                .Include(tp => tp.Player)
                .Where(tp => tp.TeamId == teamId)
                .Select(tp => new
                {
                    tp.Id,
                    tp.PlayerId,
                    tp.Player.Name,
                    tp.Player.LastName,
                    tp.Player.UrlPhoto,
                    Dorsal = tp.Dorsal != null ? tp.Dorsal.Number : (int?)null
                })
                .ToArrayAsync(cancellationToken);

            HashSet<string> linkedIds = new();
            if (membershipIdForUniquenessCheck.HasValue)
            {
                linkedIds = (await db.UserTeams
                        .AsNoTracking()
                        .Where(ut => ut.RoleId == membershipIdForUniquenessCheck.Value
                                     && ut.LinkedTeamPlayerId != null
                                     && items.Select(i => i.Id).Contains(ut.LinkedTeamPlayerId!))
                        .Select(ut => ut.LinkedTeamPlayerId!)
                        .ToArrayAsync(cancellationToken))
                    .ToHashSet();
            }

            return items.Select(i => new RosterPlayer(
                i.Id, i.PlayerId, i.Name, i.LastName, i.UrlPhoto, i.Dorsal,
                linkedIds.Contains(i.Id))).ToArray();
        }
    }
}
