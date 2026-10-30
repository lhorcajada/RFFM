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
    /// El participante paga con su monedero un boleto propio pendiente (no expirado) mientras los pronósticos siguen abiertos.
    /// Cobro todo o nada: sin saldo suficiente responde 409 y el boleto sigue pendiente.
    /// POST /api/teams/{teamId}/quiniela/{jornadaId}/my-tickets/{ticketId}/wallet-payment
    /// See openspec/changes/quiniela-wallet/design.md → D2c.
    /// </summary>
    public class PayQuinielaTicketWithWallet : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost($"{QuinielaConstants.BaseRoute}/{{jornadaId}}/my-tickets/{{ticketId}}/wallet-payment",
                    async (string teamId, string jornadaId, string ticketId, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Command(teamId, jornadaId, ticketId), ct)))
                .WithName(nameof(PayQuinielaTicketWithWallet))
                .WithTags(QuinielaConstants.Tag)
                .RequireAuthorization()
                .Produces<QuinielaTicketDto>()
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .ProducesProblem(StatusCodes.Status409Conflict);
        }

        public record Command(string TeamId, string JornadaId, string TicketId) : RFFM.Api.Common.ICommand<QuinielaTicketDto>;

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(c => c.TeamId).NotEmpty();
                RuleFor(c => c.JornadaId).NotEmpty();
                RuleFor(c => c.TicketId).NotEmpty();
            }
        }

        public class Handler(AppDbContext db, FederationDbContext federationDb, ICurrentUserService currentUser, TimeProvider timeProvider)
            : IRequestHandler<Command, QuinielaTicketDto>
        {
            public async ValueTask<QuinielaTicketDto> Handle(Command request, CancellationToken cancellationToken)
            {
                await QuinielaSupport.RequireRoleAsync(db, currentUser, request.TeamId, QuinielaSupport.ParticipantRoles, cancellationToken);

                return await QuinielaSupport.RunWithWalletRetryAsync(db, async () =>
                {
                    var jornada = await QuinielaSupport.LoadJornadaAsync(db, request.TeamId, request.JornadaId, cancellationToken);
                    var round = await QuinielaSupport.LoadRoundAsync(federationDb, jornada.RffmRoundId, cancellationToken);
                    var now = timeProvider.GetUtcNow().UtcDateTime;
                    jornada.EnsurePicksOpen(round.FirstValidKickoffUtc, now);

                    var userId = currentUser.UserId!;
                    var ticket = await db.QuinielaTickets.SingleOrDefaultAsync(
                            t => t.Id == request.TicketId && t.JornadaId == jornada.Id && t.ApplicationUserId == userId, cancellationToken)
                        ?? throw new NotFoundException("No tienes ese boleto en esta jornada.", ErrorCodes.QuinielaTicketNotFound);

                    var payable = QuinielaSupport.EffectiveStatus(ticket, round, now) == QuinielaPaymentStatus.Pending;
                    if (!payable)
                        throw new ConflictException("Solo se puede pagar con el monedero un boleto pendiente y no expirado.", ErrorCodes.QuinielaTicketNotPayable);

                    var charge = await QuinielaSupport.TryChargeFromWalletAsync(db, ticket, jornada, round, now, cancellationToken);
                    if (charge is null)
                    {
                        var balance = await db.QuinielaWallets.AsNoTracking()
                            .Where(w => w.TeamId == request.TeamId && w.ApplicationUserId == userId)
                            .Select(w => w.Balance)
                            .SingleOrDefaultAsync(cancellationToken);
                        throw new ConflictException(
                            $"Saldo insuficiente: el boleto cuesta {jornada.Price:0.00} € y tu monedero tiene {balance:0.00} €.",
                            ErrorCodes.QuinielaWalletInsufficientBalance);
                    }

                    await db.SaveChangesAsync(cancellationToken);
                    return QuinielaSupport.ToDto(ticket, round, now, charge);
                });
            }
        }
    }
}
