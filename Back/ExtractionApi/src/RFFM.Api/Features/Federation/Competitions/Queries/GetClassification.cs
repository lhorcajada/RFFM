using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Options;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Competitions.Models;
using RFFM.Api.Features.Federation.MatchResults.Services;
using RFFM.Api.Infrastructure.Options;

namespace RFFM.Api.Features.Federation.Competitions.Queries
{
    public class FederationGetClassification : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/classification",
                    async (IMediator mediator, IOptions<RffmOptions> rffmOptions, CancellationToken cancellationToken,
                        int? season = null, int competition = 25255269, int group = 25255283, int playType = 1) =>
                    {
                        var request = new QueryClassification(season ?? rffmOptions.Value.CurrentSeasonId, group);

                        var response = await mediator.Send(request, cancellationToken);

                        return Results.Ok(response);
                    })
                .WithName(nameof(FederationGetClassification))
                .WithTags(CompetitionsConstants.CompetitionsFeature)
                .Produces<ClassificationResponse>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status404NotFound);
        }

        /// <summary>
        /// No es <c>IQueryApp</c>: calcula la clasificación con los resultados guardados y los actualiza desde la
        /// RFFM cuando faltan datos, así que no debe pasar por el <c>CachingBehavior</c>.
        /// </summary>
        public record QueryClassification(int Season, int Group) : IRequest<ClassificationResponse>;

        public class RequestHandler(IRffmResultsSyncService resultsSyncService) : IRequestHandler<QueryClassification, ClassificationResponse>
        {
            public async ValueTask<ClassificationResponse> Handle(QueryClassification request, CancellationToken cancellationToken) =>
                await resultsSyncService.GetClassificationAsync(request.Group, request.Season, cancellationToken);
        }
    }
}
