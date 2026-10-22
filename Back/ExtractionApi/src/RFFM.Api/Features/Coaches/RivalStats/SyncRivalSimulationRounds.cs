using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Options;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.RivalStats.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.RivalStats
{
    /// <summary>
    /// PUT /api/teams/{teamId}/rival-stats/simulation/rounds — guarda y congela las simulaciones por jornada de
    /// la liga del equipo (design.md D4). Idempotente: las congeladas no cambian.
    /// </summary>
    public class SyncRivalSimulationRounds : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/teams/{teamId}/rival-stats/simulation/rounds",
                    async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        await mediator.Send(new SyncRivalSimulationRoundsCommand(teamId), cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(SyncRivalSimulationRounds))
                .WithTags(RivalStatsConstants.Feature)
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict)
                .RequireAuthorization();
        }

        public record SyncRivalSimulationRoundsCommand(string TeamId) : Common.ICommand, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string FeatureRoute => CoachFeatureRoutes.Convocations;
            public string RequiredPermission => "Read";
        }

        public class Validator : AbstractValidator<SyncRivalSimulationRoundsCommand>
        {
            public Validator()
            {
                RuleFor(x => x.TeamId).NotEmpty();
            }
        }

        public class Handler(AppDbContext appDb, RivalRoundSimulationService service, IOptions<RffmOptions> rffmOptions)
            : IRequestHandler<SyncRivalSimulationRoundsCommand>
        {
            public async ValueTask<Unit> Handle(SyncRivalSimulationRoundsCommand request, CancellationToken cancellationToken)
            {
                var league = await RivalStatsLeague.ResolveAsync(appDb, request.TeamId, rffmOptions.Value, cancellationToken);
                await service.SyncAsync(league, cancellationToken);
                return Unit.Value;
            }
        }
    }
}
