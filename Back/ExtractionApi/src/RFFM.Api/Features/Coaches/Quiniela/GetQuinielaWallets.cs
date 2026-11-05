using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Quiniela
{
    /// <summary>
    /// El entrenador lista los participantes del equipo (Entrenador, Jugador, Familiar) con su saldo; sin monedero = 0,00.
    /// No se pagina: es un único equipo.
    /// GET /api/teams/{teamId}/quiniela/wallets
    /// See openspec/changes/quiniela-wallet/design.md → D6.
    /// </summary>
    public class GetQuinielaWallets : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet($"{QuinielaConstants.BaseRoute}/wallets",
                    async (string teamId, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Query(teamId), ct)))
                .WithName(nameof(GetQuinielaWallets))
                .WithTags(QuinielaConstants.Tag)
                .RequireAuthorization()
                .Produces<IReadOnlyList<QuinielaWalletSummaryDto>>()
                .ProducesProblem(StatusCodes.Status403Forbidden);
        }

        public record Query(string TeamId) : IQueryApp<IReadOnlyList<QuinielaWalletSummaryDto>>;

        public class Handler(AppDbContext db, ICurrentUserService currentUser, IdentityDbContext? identityDb = null)
            : IRequestHandler<Query, IReadOnlyList<QuinielaWalletSummaryDto>>
        {
            private sealed record PlayerLink(string UserId, string TeamPlayerId, string? Name, string? LastName);

            public async ValueTask<IReadOnlyList<QuinielaWalletSummaryDto>> Handle(Query request, CancellationToken cancellationToken)
            {
                await QuinielaSupport.RequireRoleAsync(db, currentUser, request.TeamId, QuinielaSupport.CoachOnly, cancellationToken);

                var roleIds = QuinielaSupport.ParticipantRoles.Select(m => m.Id).ToArray();
                var userIds = await db.UserTeams.AsNoTracking()
                    .Where(ut => ut.TeamId == request.TeamId && roleIds.Contains(ut.RoleId))
                    .Select(ut => ut.ApplicationUserId)
                    .Distinct()
                    .ToListAsync(cancellationToken);
                var balances = await db.QuinielaWallets.AsNoTracking()
                    .Where(w => w.TeamId == request.TeamId && userIds.Contains(w.ApplicationUserId))
                    .ToDictionaryAsync(w => w.ApplicationUserId, w => w.Balance, cancellationToken);
                var participants = await QuinielaSupport.LoadParticipantsAsync(db, request.TeamId, userIds, cancellationToken, identityDb);
                var familyPlayers = await LoadFamilyPlayersAsync(request.TeamId, userIds, cancellationToken);
                var linkedPlayers = await LoadLinkedPlayersAsync(request.TeamId, userIds, cancellationToken);

                return userIds
                    .Select(id => new QuinielaWalletSummaryDto(
                        id, participants[id].Name, participants[id].Role, balances.GetValueOrDefault(id),
                        AssociatedPlayersOf(participants[id].Role, id, familyPlayers, linkedPlayers)))
                    .OrderBy(r => r.UserName)
                    .ToList();
            }

            private async Task<Dictionary<string, List<QuinielaAssociatedPlayerDto>>> LoadFamilyPlayersAsync(
                string teamId, IReadOnlyCollection<string> userIds, CancellationToken ct)
            {
                var links = await db.TeamPlayerFamilyMembers.AsNoTracking()
                    .Where(f => f.LinkedUserId != null && userIds.Contains(f.LinkedUserId) && f.TeamPlayer.TeamId == teamId)
                    .Select(f => new PlayerLink(f.LinkedUserId!, f.TeamPlayerId, f.TeamPlayer.Player.Name, f.TeamPlayer.Player.LastName))
                    .ToListAsync(ct);
                return GroupAssociatedPlayers(links);
            }

            private async Task<Dictionary<string, List<QuinielaAssociatedPlayerDto>>> LoadLinkedPlayersAsync(
                string teamId, IReadOnlyCollection<string> userIds, CancellationToken ct)
            {
                var links = await (
                        from ut in db.UserTeams.AsNoTracking()
                        join tp in db.TeamPlayers.AsNoTracking() on ut.LinkedTeamPlayerId equals tp.Id
                        where ut.TeamId == teamId && tp.TeamId == teamId && ut.RoleId == Membership.Player.Id
                              && userIds.Contains(ut.ApplicationUserId)
                        select new PlayerLink(ut.ApplicationUserId, tp.Id, tp.Player.Name, tp.Player.LastName))
                    .ToListAsync(ct);
                return GroupAssociatedPlayers(links);
            }

            private static Dictionary<string, List<QuinielaAssociatedPlayerDto>> GroupAssociatedPlayers(IEnumerable<PlayerLink> links) =>
                links.GroupBy(l => l.UserId).ToDictionary(
                    g => g.Key,
                    g => g.DistinctBy(l => l.TeamPlayerId)
                        .Select(l => new QuinielaAssociatedPlayerDto(Guid.Parse(l.TeamPlayerId), FullName(l.Name, l.LastName)))
                        .OrderBy(p => p.Name, StringComparer.OrdinalIgnoreCase)
                        .ThenBy(p => p.Id)
                        .ToList());

            private static IReadOnlyList<QuinielaAssociatedPlayerDto> AssociatedPlayersOf(
                string role, string userId,
                IReadOnlyDictionary<string, List<QuinielaAssociatedPlayerDto>> familyPlayers,
                IReadOnlyDictionary<string, List<QuinielaAssociatedPlayerDto>> linkedPlayers)
            {
                if (role == Membership.FamilyPlayer.Key && familyPlayers.TryGetValue(userId, out var family))
                    return family;
                if (role == Membership.Player.Key && linkedPlayers.TryGetValue(userId, out var linked))
                    return linked;
                return [];
            }

            private static string FullName(string? name, string? lastName) => $"{name} {lastName}".Trim();
        }
    }
}
