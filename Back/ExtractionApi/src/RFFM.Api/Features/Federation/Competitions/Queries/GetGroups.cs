using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Competitions.Services;

namespace RFFM.Api.Features.Federation.Competitions.Queries
{
    public class GetGroups : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/groups", async (IMediator mediator, CancellationToken cancellationToken, string competitionId) =>
            {
                var request = new QueryApp(competitionId);
                var response = await mediator.Send(request, cancellationToken);
                return response != null ? Results.Ok(response) : Results.NotFound();
            })
            .WithName(nameof(GetGroups))
            .WithTags(CompetitionsConstants.CompetitionsFeature)
            .Produces<ResponseGroup[]>()
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }

        public record QueryApp(string CompetitionId) : Common.IQueryApp<ResponseGroup[]>;

        public record ResponseGroup(int Id, string Name);

        public class RequestHandler : IRequestHandler<QueryApp, ResponseGroup[]>
        {
            private readonly ICompetitionService _competitionService;

            public RequestHandler(ICompetitionService competitionService)
            {
                _competitionService = competitionService;
            }

            public async ValueTask<ResponseGroup[]> Handle(QueryApp request, CancellationToken cancellationToken)
            {
                if (string.IsNullOrWhiteSpace(request.CompetitionId))
                    return Array.Empty<ResponseGroup>();

                var groups = await _competitionService.GetGroupsAsync(request.CompetitionId, cancellationToken).ConfigureAwait(false);
                if (groups == null || groups.Length == 0)
                    return Array.Empty<ResponseGroup>();

                return groups.Select(g => new ResponseGroup(g.Id, g.Name)).ToArray();
            }
        }
    }
}
