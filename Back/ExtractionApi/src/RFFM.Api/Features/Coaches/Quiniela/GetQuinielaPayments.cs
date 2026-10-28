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
    /// Bolsa y pagos de la jornada para el entrenador: boletos, totales y movimientos del fondo.
    /// GET /api/teams/{teamId}/quiniela/{jornadaId}/payments
    /// See openspec/changes/quiniela-team-pool/design.md → D7.
    /// </summary>
    public class GetQuinielaPayments : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet($"{QuinielaConstants.BaseRoute}/{{jornadaId}}/payments",
                    async (string teamId, string jornadaId, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Query(teamId, jornadaId), ct)))
                .WithName(nameof(GetQuinielaPayments))
                .WithTags(QuinielaConstants.Tag)
                .RequireAuthorization()
                .Produces<QuinielaPaymentsDto>()
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record Query(string TeamId, string JornadaId) : IQueryApp<QuinielaPaymentsDto>;

        public class Handler(AppDbContext db, FederationDbContext federationDb, ICurrentUserService currentUser, TimeProvider timeProvider)
            : IRequestHandler<Query, QuinielaPaymentsDto>
        {
            public async ValueTask<QuinielaPaymentsDto> Handle(Query request, CancellationToken cancellationToken)
            {
                await QuinielaSupport.RequireRoleAsync(db, currentUser, request.TeamId, QuinielaSupport.CoachOnly, cancellationToken);

                var jornada = await QuinielaSupport.LoadJornadaAsync(db, request.TeamId, request.JornadaId, cancellationToken, tracking: false);
                var round = await QuinielaSupport.LoadRoundAsync(federationDb, jornada.RffmRoundId, cancellationToken);
                var now = timeProvider.GetUtcNow().UtcDateTime;

                var tickets = await db.QuinielaTickets.AsNoTracking()
                    .Where(t => t.JornadaId == jornada.Id)
                    .ToListAsync(cancellationToken);
                var participants = await QuinielaSupport.LoadParticipantsAsync(
                    db, request.TeamId, tickets.Select(t => t.ApplicationUserId).ToList(), cancellationToken);

                var rows = tickets
                    .Select(t => (Ticket: t, Status: QuinielaSupport.EffectiveStatus(t, round, now)))
                    .Select(x => QuinielaSupport.ToPaymentDto(x.Ticket, participants, x.Status))
                    .OrderBy(x => x.UserName)
                    .ToList();

                var settled = jornada.Status == QuinielaJornadaStatus.Settled;
                var collected = tickets.Count(t => t.PaymentStatus == QuinielaPaymentStatus.Paid) * jornada.Price;
                var pending = tickets.Count(t => QuinielaSupport.EffectiveStatus(t, round, now) == QuinielaPaymentStatus.Pending) * jornada.Price;
                var (prizeBase, fundAmount) = QuinielaSupport.SplitCollected(collected, jornada.PrizePercent);
                var prizes = settled ? tickets.Sum(t => t.Prize ?? 0m) : 0m;

                var movements = await db.TeamFundMovements.AsNoTracking()
                    .Where(m => m.TeamId == request.TeamId && m.Source == TeamFundMovementSource.QuinielaFund)
                    .OrderByDescending(m => m.OccurredAt)
                    .Select(m => new QuinielaFundMovementDto(m.Id, m.Amount, m.OccurredAt, m.Description))
                    .ToListAsync(cancellationToken);

                var totals = new QuinielaTotalsDto(collected, pending, prizeBase + jornada.CarryIn, fundAmount, jornada.CarryIn, jornada.CarryOut, prizes, jornada.PrizePercent,
                    QuinielaSupport.SplitCollected(collected + pending, jornada.PrizePercent).PrizeBase + jornada.CarryIn);
                return new QuinielaPaymentsDto(QuinielaSupport.ToDto(jornada, round, now), rows, totals, movements, round.ToMatchDtos());
            }
        }
    }
}
