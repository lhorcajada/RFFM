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
    /// El participante elimina su propio boleto mientras siga pendiente de pago y la jornada no esté liquidada.
    /// DELETE /api/teams/{teamId}/quiniela/{jornadaId}/ticket
    /// </summary>
    public class DeleteMyQuinielaTicket : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete($"{QuinielaConstants.BaseRoute}/{{jornadaId}}/ticket",
                    async (string teamId, string jornadaId, IMediator mediator, CancellationToken ct) =>
                    {
                        await mediator.Send(new Command(teamId, jornadaId), ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteMyQuinielaTicket))
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

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<Command>
        {
            public async ValueTask<Unit> Handle(Command request, CancellationToken cancellationToken)
            {
                await QuinielaSupport.RequireRoleAsync(db, currentUser, request.TeamId, QuinielaSupport.ParticipantRoles, cancellationToken);

                var jornada = await QuinielaSupport.LoadJornadaAsync(db, request.TeamId, request.JornadaId, cancellationToken, tracking: false);
                if (jornada.Status == QuinielaJornadaStatus.Settled)
                    throw new DomainException("Quiniela", "La quiniela de esta jornada ya está liquidada.", ErrorCodes.QuinielaAlreadySettled);

                var userId = currentUser.UserId!;
                var ticket = await db.QuinielaTickets.SingleOrDefaultAsync(
                        t => t.JornadaId == request.JornadaId && t.ApplicationUserId == userId, cancellationToken)
                    ?? throw new NotFoundException("No tienes boleto en esta jornada.", ErrorCodes.QuinielaTicketNotFound);

                var alreadyPaid = ticket.PaymentStatus != QuinielaPaymentStatus.Pending;
                if (alreadyPaid)
                    throw new DomainException("Quiniela", "Solo puedes eliminar un boleto que aún no está pagado.", ErrorCodes.QuinielaTicketNotDeletable);

                db.QuinielaTickets.Remove(ticket);
                await db.SaveChangesAsync(cancellationToken);
                return Unit.Value;
            }
        }
    }
}
