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
    /// El entrenador abre la quiniela de la siguiente jornada RFFM del grupo del equipo.
    /// POST /api/teams/{teamId}/quiniela
    /// See openspec/changes/quiniela-team-pool/design.md → D6, D7.
    /// </summary>
    public class OpenQuiniela : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost(QuinielaConstants.BaseRoute,
                    async (string teamId, IMediator mediator, CancellationToken ct) =>
                    {
                        var jornada = await mediator.Send(new Command(teamId), ct);
                        return Results.Created($"/api/teams/{teamId}/quiniela/current", jornada);
                    })
                .WithName(nameof(OpenQuiniela))
                .WithTags(QuinielaConstants.Tag)
                .RequireAuthorization()
                .Produces<QuinielaJornadaDto>(StatusCodes.Status201Created)
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .ProducesProblem(StatusCodes.Status409Conflict);
        }

        public record Command(string TeamId) : RFFM.Api.Common.ICommand<QuinielaJornadaDto>;

        public class Validator : AbstractValidator<Command>
        {
            public Validator() => RuleFor(c => c.TeamId).NotEmpty();
        }

        public class Handler(AppDbContext db, FederationDbContext federationDb, ICurrentUserService currentUser, TimeProvider timeProvider)
            : IRequestHandler<Command, QuinielaJornadaDto>
        {
            public async ValueTask<QuinielaJornadaDto> Handle(Command request, CancellationToken cancellationToken)
            {
                await QuinielaSupport.RequireRoleAsync(db, currentUser, request.TeamId, QuinielaSupport.CoachOnly, cancellationToken);

                return await QuinielaLifecycle.OpenNextAsync(db, federationDb, request.TeamId, timeProvider.GetUtcNow().UtcDateTime, cancellationToken)
                    ?? throw new NotFoundException("No hay una próxima jornada con partidos pendientes.", ErrorCodes.QuinielaNoNextRound);
            }
        }
    }
}
