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
    /// El entrenador marca un boleto como pagado (con método) o de nuevo como pendiente.
    /// PUT /api/teams/{teamId}/quiniela/{jornadaId}/tickets/{ticketId}/payment
    /// See openspec/changes/quiniela-team-pool/design.md → D4, D7.
    /// </summary>
    public class SetQuinielaTicketPayment : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut($"{QuinielaConstants.BaseRoute}/{{jornadaId}}/tickets/{{ticketId}}/payment",
                    async (string teamId, string jornadaId, string ticketId, Body body, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(
                            new Command { TeamId = teamId, JornadaId = jornadaId, TicketId = ticketId, Paid = body.Paid, Method = body.Method }, ct)))
                .WithName(nameof(SetQuinielaTicketPayment))
                .WithTags(QuinielaConstants.Tag)
                .RequireAuthorization()
                .Produces<QuinielaPaymentTicketDto>()
                .ProducesValidationProblem()
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record Body(bool Paid, string? Method);

        public record Command : RFFM.Api.Common.ICommand<QuinielaPaymentTicketDto>
        {
            public string TeamId { get; init; } = null!;
            public string JornadaId { get; init; } = null!;
            public string TicketId { get; init; } = null!;
            public bool Paid { get; init; }
            public string? Method { get; init; }
        }

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(c => c.TeamId).NotEmpty();
                RuleFor(c => c.JornadaId).NotEmpty();
                RuleFor(c => c.TicketId).NotEmpty();
                RuleFor(c => c.Method)
                    .Must(method => method is not null && QuinielaPaymentMethod.TryFromName(method, out var parsed) && parsed != QuinielaPaymentMethod.Wallet)
                    .When(c => c.Paid)
                    .WithMessage("Indica cómo se ha pagado: Cash o Bizum.");
            }
        }

        public class Handler(AppDbContext db, ICurrentUserService currentUser, TimeProvider timeProvider)
            : IRequestHandler<Command, QuinielaPaymentTicketDto>
        {
            public async ValueTask<QuinielaPaymentTicketDto> Handle(Command request, CancellationToken cancellationToken)
            {
                await QuinielaSupport.RequireRoleAsync(db, currentUser, request.TeamId, QuinielaSupport.CoachOnly, cancellationToken);

                var jornada = await QuinielaSupport.LoadJornadaAsync(db, request.TeamId, request.JornadaId, cancellationToken, tracking: false);
                if (jornada.Status == QuinielaJornadaStatus.Settled)
                    throw new DomainException("Quiniela", "La quiniela de esta jornada ya está liquidada.", ErrorCodes.QuinielaAlreadySettled);

                var ticket = await db.QuinielaTickets.SingleOrDefaultAsync(
                        t => t.Id == request.TicketId && t.JornadaId == request.JornadaId, cancellationToken)
                    ?? throw new NotFoundException($"QuinielaTicket '{request.TicketId}' Not Found", ErrorCodes.QuinielaTicketNotFound);

                var now = timeProvider.GetUtcNow().UtcDateTime;
                await QuinielaSupport.RunWithWalletRetryAsync(db, async () =>
                {
                    var tracked = await db.QuinielaTickets.SingleOrDefaultAsync(
                            t => t.Id == request.TicketId && t.JornadaId == request.JornadaId, cancellationToken)
                        ?? throw new NotFoundException($"QuinielaTicket '{request.TicketId}' Not Found", ErrorCodes.QuinielaTicketNotFound);

                    // Un boleto cobrado del monedero que deja de estarlo devuelve el dinero al monedero.
                    await QuinielaSupport.RefundWalletTicketsAsync(db, [tracked], now, cancellationToken);
                    if (request.Paid)
                        tracked.MarkPaid(QuinielaPaymentMethod.FromName(request.Method!), now);
                    else
                        tracked.MarkPending();

                    await db.SaveChangesAsync(cancellationToken);
                    ticket = tracked;
                    return Unit.Value;
                });
                // Sin consultar la jornada RFFM no se conoce el plazo: se devuelve el estado guardado (Paid/Pending).
                var participants = await QuinielaSupport.LoadParticipantsAsync(db, request.TeamId, [ticket.ApplicationUserId], cancellationToken);
                return QuinielaSupport.ToPaymentDto(ticket, participants, ticket.PaymentStatus);
            }
        }
    }
}
