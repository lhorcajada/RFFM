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
    /// Saldo e historial de movimientos (más recientes primero, paginado) del monedero del usuario autenticado
    /// o, si es entrenador, de cualquier usuario del equipo.
    /// GET /api/teams/{teamId}/quiniela/wallet?limit=25&amp;offset=0
    /// GET /api/teams/{teamId}/quiniela/wallets/{userId}?limit=25&amp;offset=0
    /// See openspec/changes/quiniela-wallet/design.md → D6.
    /// </summary>
    public class GetQuinielaWallet : IFeatureModule
    {
        public const int DefaultLimit = 25;
        public const int MaxLimit = 100;

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet($"{QuinielaConstants.BaseRoute}/wallet",
                    async (string teamId, int? limit, int? offset, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Query(teamId, null, limit ?? DefaultLimit, offset ?? 0), ct)))
                .WithName("GetMyQuinielaWallet")
                .WithTags(QuinielaConstants.Tag)
                .RequireAuthorization()
                .Produces<QuinielaWalletDto>()
                .ProducesProblem(StatusCodes.Status403Forbidden);

            app.MapGet($"{QuinielaConstants.BaseRoute}/wallets/{{userId}}",
                    async (string teamId, string userId, int? limit, int? offset, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Query(teamId, userId, limit ?? DefaultLimit, offset ?? 0), ct)))
                .WithName(nameof(GetQuinielaWallet))
                .WithTags(QuinielaConstants.Tag)
                .RequireAuthorization()
                .Produces<QuinielaWalletDto>()
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        /// <param name="TeamId">Equipo.</param>
        /// <param name="UserId">null = monedero del usuario autenticado.</param>
        /// <param name="Limit">Tamaño de página (25 por defecto, máximo 100).</param>
        /// <param name="Offset">Movimientos a saltar.</param>
        public record Query(string TeamId, string? UserId, int Limit, int Offset) : IQueryApp<QuinielaWalletDto>;

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<Query, QuinielaWalletDto>
        {
            public async ValueTask<QuinielaWalletDto> Handle(Query request, CancellationToken cancellationToken)
            {
                var ownWallet = request.UserId is null || request.UserId == currentUser.UserId;
                await QuinielaSupport.RequireRoleAsync(db, currentUser, request.TeamId,
                    ownWallet ? QuinielaSupport.ParticipantRoles : QuinielaSupport.CoachOnly, cancellationToken);

                var userId = ownWallet ? currentUser.UserId! : request.UserId!;
                if (!ownWallet)
                    await QuinielaSupport.EnsureWalletOwnerInTeamAsync(db, request.TeamId, userId, cancellationToken);

                var limit = Math.Clamp(request.Limit <= 0 ? DefaultLimit : request.Limit, 1, MaxLimit);
                var offset = Math.Max(request.Offset, 0);

                var wallet = await db.QuinielaWallets.AsNoTracking()
                    .SingleOrDefaultAsync(w => w.TeamId == request.TeamId && w.ApplicationUserId == userId, cancellationToken);
                var participant = (await QuinielaSupport.LoadParticipantsAsync(db, request.TeamId, [userId], cancellationToken))[userId];
                if (wallet is null)
                    return new QuinielaWalletDto(userId, participant.Name, participant.Role, 0m, 0, []);

                var movements = db.QuinielaWalletMovements.AsNoTracking().Where(m => m.WalletId == wallet.Id);
                var total = await movements.CountAsync(cancellationToken);
                var page = await movements.OrderByDescending(m => m.OccurredAt).ThenByDescending(m => m.Id)
                    .Skip(offset).Take(limit).ToListAsync(cancellationToken);
                return new QuinielaWalletDto(userId, participant.Name, participant.Role, wallet.Balance, total,
                    page.Select(QuinielaSupport.ToDto).ToList());
            }
        }
    }
}
