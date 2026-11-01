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
    /// Boletos de una quiniela liquidada con el resultado de cada partido: el entrenador ve todos y el resto solo los suyos.
    /// GET /api/teams/{teamId}/quiniela/{jornadaId}/results
    /// </summary>
    public class GetQuinielaJornadaResults : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet($"{QuinielaConstants.BaseRoute}/{{jornadaId}}/results",
                    async (string teamId, string jornadaId, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Query(teamId, jornadaId), ct)))
                .WithName(nameof(GetQuinielaJornadaResults))
                .WithTags(QuinielaConstants.Tag)
                .RequireAuthorization()
                .Produces<QuinielaJornadaResultsDto>()
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record Query(string TeamId, string JornadaId) : IQueryApp<QuinielaJornadaResultsDto>;

        public class Handler(AppDbContext db, FederationDbContext federationDb, ICurrentUserService currentUser, IdentityDbContext? identityDb = null)
            : IRequestHandler<Query, QuinielaJornadaResultsDto>
        {
            public async ValueTask<QuinielaJornadaResultsDto> Handle(Query request, CancellationToken cancellationToken)
            {
                await QuinielaSupport.RequireRoleAsync(db, currentUser, request.TeamId, QuinielaSupport.ParticipantRoles, cancellationToken);

                var jornada = await QuinielaSupport.LoadJornadaAsync(db, request.TeamId, request.JornadaId, cancellationToken, tracking: false);
                if (jornada.Status != QuinielaJornadaStatus.Settled)
                    throw new DomainException("Quiniela", "La quiniela de esta jornada todavía no está liquidada.", ErrorCodes.QuinielaNotSettled);

                var userId = currentUser.UserId!;
                var isCoach = await QuinielaSupport.IsCoachAsync(db, userId, request.TeamId, cancellationToken);
                var round = await QuinielaSupport.LoadRoundAsync(federationDb, jornada.RffmRoundId, cancellationToken);

                var tickets = await db.QuinielaTickets.AsNoTracking()
                    .Where(t => t.JornadaId == jornada.Id && (isCoach || t.ApplicationUserId == userId))
                    .OrderBy(t => t.Number)
                    .ToListAsync(cancellationToken);
                var participants = await QuinielaSupport.LoadParticipantsAsync(
                    db, request.TeamId, tickets.Select(t => t.ApplicationUserId).ToList(), cancellationToken, identityDb);

                var rows = tickets
                    .Select(t => QuinielaSupport.ToPaymentDto(t, participants, t.PaymentStatus))
                    .OrderBy(x => x.UserName)
                    .ThenBy(x => x.Number)
                    .ToList();
                return new QuinielaJornadaResultsDto(round.Number, round.ToMatchDtos(), rows);
            }
        }
    }
}
