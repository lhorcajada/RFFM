using HtmlAgilityPack;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Helpers;
using RFFM.Api.Features.Competitions.Services;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Linq;

namespace RFFM.Api.Features.Competitions.Queries
{
    public class GetCompetitions : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/competitions", async (IMediator mediator, CancellationToken cancellationToken) =>
            {
                var request = new Query();
                var response = await mediator.Send(request, cancellationToken);
                return response != null ? Results.Ok(response) : Results.NotFound();
            })
            .WithName(nameof(GetCompetitions))
            .WithTags("Competitions")
            .Produces<ResponseCompetition[]>()
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }

        public record Query() : Common.IQuery<ResponseCompetition[]>;

        public record ResponseCompetition(string Id, string Name);

        public class RequestHandler : IRequestHandler<Query, ResponseCompetition[]>
        {
            private readonly ICompetitionService _competitionService;

            public RequestHandler(ICompetitionService competitionService)
            {
                _competitionService = competitionService;
            }

            public async ValueTask<ResponseCompetition[]> Handle(Query request, CancellationToken cancellationToken)
            {
                var comps = await _competitionService.GetCompetitionsAsync(cancellationToken).ConfigureAwait(false);
                if (comps == null || comps.Length ==0)
                    return Array.Empty<ResponseCompetition>();

                return comps.Select(c => new ResponseCompetition(c.Id, c.Name)).ToArray();
            }
        }
    }
}
