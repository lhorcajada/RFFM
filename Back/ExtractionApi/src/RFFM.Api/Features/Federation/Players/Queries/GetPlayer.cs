using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Players.Models;
using RFFM.Api.Features.Federation.Players.Services;

namespace RFFM.Api.Features.Federation.Players.Queries
{
    public class GetPlayer : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/players/{id}",
                    async (string id, [FromQuery] string? seasonId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        // Si no se proporciona temporada, usar la actual (21 para 2025-2026)
                        var season = seasonId ?? "21";
                        var request = new PlayerQuery(id, int.Parse(season));

                        var response = await mediator.Send(request, cancellationToken);

                        return response != null ? Results.Ok(response) : Results.NotFound();
                    })
                .WithName(nameof(GetPlayer))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<Player>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record PlayerQuery(string PlayerId, int SeasonId) : Common.IQuery<Player>
        {
        }

        public class RequestHandler : IRequestHandler<PlayerQuery, Player?>
        {
            private readonly IPlayerService _playerService;

            public RequestHandler(IPlayerService playerService)
            {
                _playerService = playerService;
            }

            public async ValueTask<Player?> Handle(PlayerQuery request, CancellationToken cancellationToken)
            {
                return await _playerService.GetPlayerAsync(request.PlayerId, request.SeasonId, cancellationToken);
            }
        }
    }
}
