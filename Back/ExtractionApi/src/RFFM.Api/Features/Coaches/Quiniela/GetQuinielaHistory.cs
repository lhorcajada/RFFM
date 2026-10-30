using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Quiniela
{
    /// <summary>
    /// Histórico paginado de las quinielas liquidadas del equipo, con premiados y el resultado del participante.
    /// GET /api/teams/{teamId}/quiniela/history?limit=10&amp;offset=0
    /// See openspec/changes/quiniela-auto-settle-history/design.md → D4.
    /// </summary>
    public class GetQuinielaHistory : IFeatureModule
    {
        private const int DefaultLimit = 10;
        private const int MaxLimit = 50;

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet($"{QuinielaConstants.BaseRoute}/history",
                    async (string teamId, int? limit, int? offset, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Query(teamId, limit, offset), ct)))
                .WithName(nameof(GetQuinielaHistory))
                .WithTags(QuinielaConstants.Tag)
                .RequireAuthorization()
                .Produces<QuinielaHistoryDto>()
                .ProducesProblem(StatusCodes.Status403Forbidden);
        }

        public record Query(string TeamId, int? Limit = null, int? Offset = null) : IQueryApp<QuinielaHistoryDto>;

        public class Handler(AppDbContext db, FederationDbContext federationDb, ICurrentUserService currentUser)
            : IRequestHandler<Query, QuinielaHistoryDto>
        {
            public async ValueTask<QuinielaHistoryDto> Handle(Query request, CancellationToken cancellationToken)
            {
                await QuinielaSupport.RequireRoleAsync(db, currentUser, request.TeamId, QuinielaSupport.ParticipantRoles, cancellationToken);

                var limit = Math.Clamp(request.Limit ?? DefaultLimit, 1, MaxLimit);
                var offset = Math.Max(request.Offset ?? 0, 0);
                var settled = db.QuinielaJornadas.AsNoTracking()
                    .Where(j => j.TeamId == request.TeamId && j.Status == QuinielaJornadaStatus.Settled);

                var total = await settled.CountAsync(cancellationToken);
                var page = await settled.OrderByDescending(j => j.SettledAt).Skip(offset).Take(limit).ToListAsync(cancellationToken);
                if (page.Count == 0)
                    return new QuinielaHistoryDto(total, []);

                var roundIds = page.Select(j => j.RffmRoundId).ToList();
                var roundNumbers = await federationDb.RffmRounds.AsNoTracking()
                    .Where(r => roundIds.Contains(r.Id))
                    .ToDictionaryAsync(r => r.Id, r => r.Number, cancellationToken);
                var results = await QuinielaSupport.LoadResultsAsync(
                    db, request.TeamId, page.Select(j => j.Id).ToList(), currentUser.UserId!, cancellationToken);

                var items = page.Select(j =>
                {
                    var result = results[j.Id];
                    var collected = result.PaidTickets * j.Price;
                    var prizePool = QuinielaSupport.SplitCollected(collected, j.PrizePercent).PrizeBase + j.CarryIn;
                    return new QuinielaHistoryItemDto(
                        j.Id, roundNumbers.GetValueOrDefault(j.RffmRoundId), j.SettledAt!.Value, collected, prizePool, j.CarryOut ?? 0m,
                        result.MyHits, result.MyCategory, result.MyPrize, result.Winners);
                }).ToList();

                return new QuinielaHistoryDto(total, items);
            }
        }
    }
}
