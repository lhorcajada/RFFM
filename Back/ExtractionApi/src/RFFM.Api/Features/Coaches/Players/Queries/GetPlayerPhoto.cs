using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    public class GetPlayerPhoto : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/catalog/player/photo",
                    async ([FromQuery] string url, [FromServices] IMediator mediator,
                        CancellationToken cancellationToken) =>
                    {
                        var query = new GetPlayerPhotoQuery { Url = url };
                        var result = await mediator.Send(query, cancellationToken);
                        return result != null ? Results.Redirect(result.Url) : Results.NotFound();
                    })
                .WithName(nameof(GetPlayerPhoto))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces(StatusCodes.Status302Found)
                .Produces(StatusCodes.Status404NotFound);
        }
    }

    public class GetPlayerPhotoQuery : IQueryApp<GetPlayerPhotoResult>
    {
        public string Url { get; set; }
    }

    public class GetPlayerPhotoResult
    {
        public string Url { get; set; }
    }

    public class GetPlayerPhotoHandler : IRequestHandler<GetPlayerPhotoQuery, GetPlayerPhotoResult>
    {
        public ValueTask<GetPlayerPhotoResult> Handle(GetPlayerPhotoQuery request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrEmpty(request.Url))
                throw new ArgumentException("URL cannot be null or empty.");

            return ValueTask.FromResult(new GetPlayerPhotoResult { Url = request.Url });
        }
    }
}
