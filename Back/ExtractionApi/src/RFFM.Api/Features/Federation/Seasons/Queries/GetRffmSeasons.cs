using System.Security.Claims;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Options;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Seasons.Services;
using RFFM.Api.Infrastructure.Options;

namespace RFFM.Api.Features.Federation.Seasons.Queries
{
    public class GetRffmSeasons : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/rffm/seasons",
                    async (IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                        var query = new QueryApp(userId);
                        var result = await mediator.Send(query, cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetRffmSeasons))
                .WithTags(SeasonsConstants.SeasonsFeature)
                .Produces<RffmSeasonsResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .RequireAuthorization();
        }

        public record QueryApp(string? UserId) : IRequest<RffmSeasonsResponse>;

        public record RffmSeasonsResponse(int CurrentSeasonId, int? PreferredSeasonId, RffmSeasonOption[] Seasons);

        public class Handler : IRequestHandler<QueryApp, RffmSeasonsResponse>
        {
            private readonly IRffmSeasonPreferenceService _service;
            private readonly IOptions<RffmOptions> _rffmOptions;

            public Handler(IRffmSeasonPreferenceService service, IOptions<RffmOptions> rffmOptions)
            {
                _service = service;
                _rffmOptions = rffmOptions;
            }

            public async ValueTask<RffmSeasonsResponse> Handle(QueryApp request, CancellationToken cancellationToken)
            {
                int? preferredSeasonId = null;
                if (!string.IsNullOrEmpty(request.UserId))
                {
                    var preference = await _service.GetForUserAsync(request.UserId, cancellationToken);
                    preferredSeasonId = preference?.SeasonId;
                }

                return new RffmSeasonsResponse(
                    _rffmOptions.Value.CurrentSeasonId,
                    preferredSeasonId,
                    _rffmOptions.Value.SelectableSeasons.ToArray());
            }
        }
    }
}
