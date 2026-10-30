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
    /// El entrenador reinicia la jornada abierta: se descartan la jornada y todos sus boletos para poder abrirla de nuevo.
    /// DELETE /api/teams/{teamId}/quiniela/{jornadaId}
    /// </summary>
    public class ResetQuiniela : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete($"{QuinielaConstants.BaseRoute}/{{jornadaId}}",
                    async (string teamId, string jornadaId, IMediator mediator, CancellationToken ct) =>
                    {
                        await mediator.Send(new Command(teamId, jornadaId), ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(ResetQuiniela))
                .WithTags(QuinielaConstants.Tag)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record Command(string TeamId, string JornadaId) : RFFM.Api.Common.ICommand;

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(c => c.TeamId).NotEmpty();
                RuleFor(c => c.JornadaId).NotEmpty();
            }
        }

        public class Handler(AppDbContext db, ICurrentUserService currentUser, TimeProvider? timeProvider = null) : IRequestHandler<Command>
        {
            public async ValueTask<Unit> Handle(Command request, CancellationToken cancellationToken)
            {
                await QuinielaSupport.RequireRoleAsync(db, currentUser, request.TeamId, QuinielaSupport.CoachOnly, cancellationToken);

                await QuinielaSupport.RunWithWalletRetryAsync(db, async () =>
                {
                    var jornada = await QuinielaSupport.LoadJornadaAsync(db, request.TeamId, request.JornadaId, cancellationToken);
                    if (jornada.Status == QuinielaJornadaStatus.Settled)
                        throw new DomainException("Quiniela", "La quiniela de esta jornada ya está liquidada.", ErrorCodes.QuinielaAlreadySettled);

                    var tickets = await db.QuinielaTickets.Where(t => t.JornadaId == jornada.Id).ToListAsync(cancellationToken);
                    var now = (timeProvider ?? TimeProvider.System).GetUtcNow().UtcDateTime;
                    await QuinielaSupport.RefundWalletTicketsAsync(db, tickets, now, cancellationToken);
                    db.QuinielaTickets.RemoveRange(tickets);
                    db.QuinielaJornadas.Remove(jornada);
                    await db.SaveChangesAsync(cancellationToken);
                    return Unit.Value;
                });
                return Unit.Value;
            }
        }
    }
}
