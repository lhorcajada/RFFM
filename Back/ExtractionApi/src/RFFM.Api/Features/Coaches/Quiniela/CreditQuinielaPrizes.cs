using FluentValidation;
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
    /// El entrenador abona una sola vez a los monederos los premios de las quinielas ya liquidadas que todavía no se
    /// ingresaron. Es idempotente: un boleto con movimiento de premio no se vuelve a abonar.
    /// POST /api/teams/{teamId}/quiniela/wallets/prize-credits
    /// </summary>
    public class CreditQuinielaPrizes : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost($"{QuinielaConstants.BaseRoute}/wallets/prize-credits",
                    async (string teamId, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Command(teamId), ct)))
                .WithName(nameof(CreditQuinielaPrizes))
                .WithTags(QuinielaConstants.Tag)
                .RequireAuthorization()
                .Produces<QuinielaPrizeCreditDto>()
                .ProducesValidationProblem()
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status409Conflict);
        }

        public record Command(string TeamId) : RFFM.Api.Common.ICommand<QuinielaPrizeCreditDto>;

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(c => c.TeamId).NotEmpty();
            }
        }

        public class Handler(AppDbContext db, FederationDbContext federationDb, ICurrentUserService currentUser, TimeProvider timeProvider)
            : IRequestHandler<Command, QuinielaPrizeCreditDto>
        {
            public async ValueTask<QuinielaPrizeCreditDto> Handle(Command request, CancellationToken cancellationToken)
            {
                await QuinielaSupport.RequireRoleAsync(db, currentUser, request.TeamId, QuinielaSupport.CoachOnly, cancellationToken);

                return await QuinielaSupport.RunWithWalletRetryAsync(db, async () =>
                {
                    var jornadas = await db.QuinielaJornadas.AsNoTracking()
                        .Where(j => j.TeamId == request.TeamId && j.Status == QuinielaJornadaStatus.Settled)
                        .ToListAsync(cancellationToken);
                    if (jornadas.Count == 0)
                        return new QuinielaPrizeCreditDto(0, 0m);

                    var roundIds = jornadas.Select(j => j.RffmRoundId).ToList();
                    var roundNumbers = await federationDb.RffmRounds.AsNoTracking()
                        .Where(r => roundIds.Contains(r.Id))
                        .ToDictionaryAsync(r => r.Id, r => r.Number, cancellationToken);
                    var roundOfJornada = jornadas.ToDictionary(j => j.Id, j => roundNumbers.GetValueOrDefault(j.RffmRoundId));

                    var jornadaIds = jornadas.Select(j => j.Id).ToList();
                    var tickets = await db.QuinielaTickets.AsNoTracking()
                        .Where(t => jornadaIds.Contains(t.JornadaId) && t.Prize > 0m)
                        .ToListAsync(cancellationToken);

                    var now = timeProvider.GetUtcNow().UtcDateTime;
                    var result = await QuinielaSupport.CreditPrizesAsync(
                        db, request.TeamId, tickets.Select(t => (t, roundOfJornada[t.JornadaId])).ToList(), now, " (abono retroactivo)", cancellationToken);
                    await db.SaveChangesAsync(cancellationToken);
                    return result;
                });
            }
        }
    }
}
