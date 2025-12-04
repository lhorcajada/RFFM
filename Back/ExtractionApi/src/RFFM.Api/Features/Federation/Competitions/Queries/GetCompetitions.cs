using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Competitions.Services;

namespace RFFM.Api.Features.Federation.Competitions.Queries
{
    public class GetCompetitions : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/competitions", async (IMediator mediator, CancellationToken cancellationToken) =>
            {
                var request = new QueryApp();
                var response = await mediator.Send(request, cancellationToken);
                return response != null ? Results.Ok(response) : Results.NotFound();
            })
            .WithName(nameof(GetCompetitions))
            .WithTags(CompetitionsConstants.CompetitionsFeature)
            .Produces<ResponseCompetition[]>()
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }

        public record QueryApp() : Common.IQueryApp<ResponseCompetition[]>;

        public record ResponseCompetition(int Id, string Name);

        public class RequestHandler : IRequestHandler<QueryApp, ResponseCompetition[]>
        {
            private readonly ICompetitionService _competitionService;

            public RequestHandler(ICompetitionService competitionService)
            {
                _competitionService = competitionService;
            }

            public async ValueTask<ResponseCompetition[]> Handle(QueryApp request, CancellationToken cancellationToken)
            {
                var comps = await _competitionService.GetCompetitionsAsync(cancellationToken).ConfigureAwait(false);
                if (comps == null || comps.Length ==0)
                    return Array.Empty<ResponseCompetition>();

                return comps.Select(c => new ResponseCompetition(c.CompetitionId, c.Name)).ToArray();
            }
        }
    }
}
