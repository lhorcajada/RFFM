using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
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

        public class Handler(AppDbContext db, ICurrentUserService currentUser)
            : IRequestHandler<Query, IReadOnlyList<QuinielaWalletSummaryDto>>
        {
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
                var participants = await QuinielaSupport.LoadParticipantsAsync(db, request.TeamId, userIds, cancellationToken);

                return userIds
                    .Select(id => new QuinielaWalletSummaryDto(id, participants[id].Name, participants[id].Role, balances.GetValueOrDefault(id)))
                    .OrderBy(r => r.UserName)
                    .ToList();
            }
        }
    }
}
