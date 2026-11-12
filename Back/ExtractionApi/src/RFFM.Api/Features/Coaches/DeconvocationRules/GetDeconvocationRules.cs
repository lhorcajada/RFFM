using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.DeconvocationRules
{
    /// <summary>
    /// Reglas de la propuesta de desconvocatoria del equipo. Solo el entrenador.
    /// GET /api/teams/{teamId}/deconvocation-rules
    /// </summary>
    public class GetDeconvocationRules : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(DeconvocationRulesConstants.BaseRoute,
                    async (string teamId, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Query(teamId), ct)))
                .WithName(nameof(GetDeconvocationRules))
                .WithTags(DeconvocationRulesConstants.Tag)
                .RequireAuthorization()
                .Produces<DeconvocationRulesDto>()
                .ProducesProblem(StatusCodes.Status403Forbidden);
        }

        public record Query(string TeamId) : IQueryApp<DeconvocationRulesDto>;

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<Query, DeconvocationRulesDto>
        {
            public async ValueTask<DeconvocationRulesDto> Handle(Query request, CancellationToken cancellationToken)
            {
                await DeconvocationRulesSupport.RequireCoachAsync(db, currentUser, request.TeamId, cancellationToken);
                return await DeconvocationRulesSupport.LoadAsync(db, request.TeamId, cancellationToken);
            }
        }
    }
}
