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
    /// El participante elimina uno de sus boletos (pendiente, expirado o pagado con el monedero, que se reembolsa) mientras los
    /// pronósticos sigan abiertos. Un boleto pagado en mano o por Bizum solo lo borra el entrenador.
    /// DELETE /api/teams/{teamId}/quiniela/{jornadaId}/my-tickets/{ticketId}
    /// </summary>
    public class DeleteMyQuinielaTicket : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete($"{QuinielaConstants.BaseRoute}/{{jornadaId}}/my-tickets/{{ticketId}}",
                    async (string teamId, string jornadaId, string ticketId, IMediator mediator, CancellationToken ct) =>
                    {
                        await mediator.Send(new Command(teamId, jornadaId, ticketId), ct);
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

        public class Handler(AppDbContext db, FederationDbContext federationDb, ICurrentUserService currentUser, TimeProvider timeProvider) : IRequestHandler<Command>
        {
            public async ValueTask<Unit> Handle(Command request, CancellationToken cancellationToken)
            {
                await QuinielaSupport.RequireRoleAsync(db, currentUser, request.TeamId, QuinielaSupport.ParticipantRoles, cancellationToken);

                await QuinielaSupport.RunWithWalletRetryAsync(db, async () =>
                {
                    var jornada = await QuinielaSupport.LoadJornadaAsync(db, request.TeamId, request.JornadaId, cancellationToken, tracking: false);
                    if (jornada.Status == QuinielaJornadaStatus.Settled)
                        throw new DomainException("Quiniela", "La quiniela de esta jornada ya está liquidada.", ErrorCodes.QuinielaAlreadySettled);

                    var round = await QuinielaSupport.LoadRoundAsync(federationDb, jornada.RffmRoundId, cancellationToken);
                    var now = timeProvider.GetUtcNow().UtcDateTime;
                    jornada.EnsurePicksOpen(round.FirstValidKickoffUtc, now);

                    var userId = currentUser.UserId!;
                    var ticket = await db.QuinielaTickets.SingleOrDefaultAsync(
                            t => t.Id == request.TicketId && t.JornadaId == request.JornadaId && t.ApplicationUserId == userId, cancellationToken)
                        ?? throw new NotFoundException("No tienes ese boleto en esta jornada.", ErrorCodes.QuinielaTicketNotFound);

                    var paidManually = ticket.PaymentStatus == QuinielaPaymentStatus.Paid && !ticket.PaidFromWallet;
                    if (paidManually)
                        throw new ConflictException(
                            "Un boleto pagado en mano o por Bizum solo lo puede eliminar el entrenador, que te devolverá el dinero.",
                            ErrorCodes.QuinielaTicketPaidManually);

                    await QuinielaSupport.RefundWalletTicketsAsync(db, [ticket], now, cancellationToken);
                    db.QuinielaTickets.Remove(ticket);
                    await db.SaveChangesAsync(cancellationToken);
                    return Unit.Value;
                });
                return Unit.Value;
            }
        }
    }
}
