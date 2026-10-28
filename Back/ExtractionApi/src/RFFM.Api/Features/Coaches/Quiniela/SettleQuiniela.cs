using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Quiniela
{
    /// <summary>
    /// Liquida la jornada: aciertos, categorías y premios (QuinielaScoring), bote para la siguiente jornada y
    /// aportación al fondo del equipo.
    /// POST /api/teams/{teamId}/quiniela/{jornadaId}/settle
    /// See openspec/changes/quiniela-team-pool/design.md → D5, D7.
    /// </summary>
    public class SettleQuiniela : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost($"{QuinielaConstants.BaseRoute}/{{jornadaId}}/settle",
                    async (string teamId, string jornadaId, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Command(teamId, jornadaId), ct)))
                .WithName(nameof(SettleQuiniela))
                .WithTags(QuinielaConstants.Tag)
                .RequireAuthorization()
                .Produces<QuinielaSettlementDto>()
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record Command(string TeamId, string JornadaId) : RFFM.Api.Common.ICommand<QuinielaSettlementDto>;

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(c => c.TeamId).NotEmpty();
                RuleFor(c => c.JornadaId).NotEmpty();
            }
        }

        public class Handler(AppDbContext db, FederationDbContext federationDb, ICurrentUserService currentUser, TimeProvider timeProvider)
            : IRequestHandler<Command, QuinielaSettlementDto>
        {
            public async ValueTask<QuinielaSettlementDto> Handle(Command request, CancellationToken cancellationToken)
            {
                await QuinielaSupport.RequireRoleAsync(db, currentUser, request.TeamId, QuinielaSupport.CoachOnly, cancellationToken);

                var jornada = await QuinielaSupport.LoadJornadaAsync(db, request.TeamId, request.JornadaId, cancellationToken);
                if (jornada.Status == QuinielaJornadaStatus.Settled)
                    throw new DomainException("Quiniela", "La quiniela de esta jornada ya está liquidada.", ErrorCodes.QuinielaAlreadySettled);

                var round = await QuinielaSupport.LoadRoundAsync(federationDb, jornada.RffmRoundId, cancellationToken);
                var tickets = await db.QuinielaTickets.Where(t => t.JornadaId == jornada.Id).ToListAsync(cancellationToken);

                var result = QuinielaScoring.Score(round.ToMatchInfos(), tickets, jornada.Price, jornada.PrizePercent, jornada.CarryIn);

                var now = timeProvider.GetUtcNow().UtcDateTime;
                foreach (var score in result.Tickets)
                    tickets.Single(t => t.Id == score.TicketId).ApplyResult(score.Hits, score.Category, score.Prize);
                jornada.Settle(result.CarryOut, now);

                if (result.FundAmount > 0m)
                    db.TeamFundMovements.Add(TeamFundMovement.Create(
                        request.TeamId, result.FundAmount, TeamFundMovementSource.QuinielaFund, null, now,
                        $"Quiniela jornada {round.Number}"));

                await db.SaveChangesAsync(cancellationToken);

                return new QuinielaSettlementDto(
                    result.Collected, result.PrizePool, result.FundAmount, result.CarryOut,
                    result.Tickets.Select(t => new QuinielaTicketResultDto(t.TicketId, t.Hits, t.Category.Name, t.Prize)).ToList());
            }
        }
    }
}
