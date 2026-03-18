using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;

namespace RFFM.Api.Features.Coaches.Teams.Queries
{
    public class GetTeamPhoto : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/catalog/team/photo",
                    async ([FromQuery] string url, [FromServices] IMediator mediator,
                        CancellationToken cancellationToken) =>
                    {
                        var query = new GetTeamPhotoQuery { Url = url };
                        var result = await mediator.Send(query, cancellationToken);
                        return result != null ? Results.Redirect(result.Url) : Results.NotFound();
                    })
                .WithName(nameof(GetTeamPhoto))
                .WithTags(TeamConstants.TeamFeature)
                .Produces(StatusCodes.Status302Found)
                .Produces(StatusCodes.Status404NotFound);
        }
    }

    public class GetTeamPhotoQuery : IQueryApp<GetTeamPhotoResult>
    {
        public string Url { get; set; }
    }

    public class GetTeamPhotoResult
    {
        public string Url { get; set; }
    }

    public class GetTeamPhotoHandler : IRequestHandler<GetTeamPhotoQuery, GetTeamPhotoResult>
    {
        public ValueTask<GetTeamPhotoResult> Handle(GetTeamPhotoQuery request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrEmpty(request.Url))
                throw new ArgumentException("URL cannot be null or empty.");

            return ValueTask.FromResult(new GetTeamPhotoResult { Url = request.Url });
        }
    }
}
