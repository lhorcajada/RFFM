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
                var request = new Query(competitionId);
                var response = await mediator.Send(request, cancellationToken);
                return response != null ? Results.Ok(response) : Results.NotFound();
            })
            .WithName(nameof(GetGroups))
            .WithTags("Competitions")
            .Produces<ResponseGroup[]>()
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }

        public record Query(string CompetitionId) : Common.IQuery<ResponseGroup[]>;

        public record ResponseGroup(int Id, string Name);

        public class RequestHandler : IRequestHandler<Query, ResponseGroup[]>
        {
            private readonly ICompetitionService _competitionService;

            public RequestHandler(ICompetitionService competitionService)
            {
                _competitionService = competitionService;
            }

            public async ValueTask<ResponseGroup[]> Handle(Query request, CancellationToken cancellationToken)
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
