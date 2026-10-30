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
    /// El entrenador elimina el boleto de cualquier participante mientras la jornada no esté liquidada.
    /// DELETE /api/teams/{teamId}/quiniela/{jornadaId}/tickets/{ticketId}
    /// </summary>
    public class DeleteQuinielaTicket : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete($"{QuinielaConstants.BaseRoute}/{{jornadaId}}/tickets/{{ticketId}}",
                    async (string teamId, string jornadaId, string ticketId, IMediator mediator, CancellationToken ct) =>
                    {
                        await mediator.Send(new Command(teamId, jornadaId, ticketId), ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteQuinielaTicket))
                .WithTags(QuinielaConstants.Tag)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record Command(string TeamId, string JornadaId, string TicketId) : RFFM.Api.Common.ICommand;

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(c => c.TeamId).NotEmpty();
                RuleFor(c => c.JornadaId).NotEmpty();
                RuleFor(c => c.TicketId).NotEmpty();
            }
        }

        public class Handler(AppDbContext db, ICurrentUserService currentUser, TimeProvider? timeProvider = null) : IRequestHandler<Command>
        {
            public async ValueTask<Unit> Handle(Command request, CancellationToken cancellationToken)
            {
                await QuinielaSupport.RequireRoleAsync(db, currentUser, request.TeamId, QuinielaSupport.CoachOnly, cancellationToken);

                var jornada = await QuinielaSupport.LoadJornadaAsync(db, request.TeamId, request.JornadaId, cancellationToken, tracking: false);
                if (jornada.Status == QuinielaJornadaStatus.Settled)
                    throw new DomainException("Quiniela", "La quiniela de esta jornada ya está liquidada.", ErrorCodes.QuinielaAlreadySettled);

                await QuinielaSupport.RunWithWalletRetryAsync(db, async () =>
                {
                    var tracked = await db.QuinielaTickets.SingleOrDefaultAsync(
                            t => t.Id == request.TicketId && t.JornadaId == request.JornadaId, cancellationToken)
                        ?? throw new NotFoundException($"QuinielaTicket '{request.TicketId}' Not Found", ErrorCodes.QuinielaTicketNotFound);
                    var now = (timeProvider ?? TimeProvider.System).GetUtcNow().UtcDateTime;
                    await QuinielaSupport.RefundWalletTicketsAsync(db, [tracked], now, cancellationToken);
                    db.QuinielaTickets.Remove(tracked);
                    await db.SaveChangesAsync(cancellationToken);
                    return Unit.Value;
                });
                return Unit.Value;
            }
        }
    }
}
