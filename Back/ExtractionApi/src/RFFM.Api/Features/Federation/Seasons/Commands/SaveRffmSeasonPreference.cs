using System.Security.Claims;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Seasons.Services;

namespace RFFM.Api.Features.Federation.Seasons.Commands
{
    public class SaveRffmSeasonPreference : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/rffm/season-preference",
                    async (SaveRffmSeasonPreferenceRequest request, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                        var cmd = new CommandApp(userId, request.SeasonId);
                        await mediator.Send(cmd, cancellationToken);

                        return Results.NoContent();
                    })
                .WithName(nameof(SaveRffmSeasonPreference))
                .WithTags(SeasonsConstants.SeasonsFeature)
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .RequireAuthorization();
        }

        public record SaveRffmSeasonPreferenceRequest(int SeasonId);

        public record CommandApp(string UserId, int SeasonId) : IRequest;

        public class Handler : IRequestHandler<CommandApp>
        {
            private readonly IRffmSeasonPreferenceService _service;

            public Handler(IRffmSeasonPreferenceService service)
            {
                _service = service;
            }

            public async ValueTask<Unit> Handle(CommandApp request, CancellationToken cancellationToken)
            {
                await _service.UpsertAsync(request.UserId, request.SeasonId, cancellationToken);
                return Unit.Value;
            }
        }
    }
}
