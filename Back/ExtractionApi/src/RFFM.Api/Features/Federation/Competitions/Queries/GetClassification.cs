using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Competitions.Models;
using RFFM.Api.Features.Federation.Competitions.Services;
using RFFM.Api.Features.Federation.Teams;

namespace RFFM.Api.Features.Federation.Competitions.Queries
{
    public class GetClassification : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/classification",
                    async (IMediator mediator, CancellationToken cancellationToken, int season = 21, int competition = 25255269, int group = 25255283, int playType = 1) =>
                    {
                        var request = new Query(season, competition, group, playType);

                        var response = await mediator.Send(request, cancellationToken);

                        return Results.Ok(response);
                    })
                .WithName(nameof(GetClassification))
                .WithTags(TeamsConstants.TeamsFeature)
                .Produces<ClassificationResponse>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record Query(int Season, int Competition, int Group, int PlayType)
            : Common.IQuery<ClassificationResponse>;
 

        public record ResponseTeam(string Id, string Name, string Link);
 

        public class RequestHandler : IRequestHandler<Query, ClassificationResponse>
        {
            private readonly ICompetitionService _competitionService;

            public RequestHandler(ICompetitionService competitionService)
            {
                _competitionService = competitionService;
            }

            public async ValueTask<ClassificationResponse> Handle(Query request, CancellationToken cancellationToken)
            {
                return await _competitionService.GetClassification(request.Group,
                    cancellationToken);

            }

  
        }

    }
}
