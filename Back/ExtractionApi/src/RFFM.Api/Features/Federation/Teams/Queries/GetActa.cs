using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Features.Federation.Teams.Services;

namespace RFFM.Api.Features.Federation.Teams.Queries
{
    public class GetActa : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/acta/{codActa}", async (IActaService actaService, CancellationToken cancellationToken,
                    string codActa= "5440937", int temporada = 21, int competicion = 25255269, int grupo = 25255283) =>
                {
                    var game = await actaService.GetMatchFromActaAsync(codActa, temporada, competicion, grupo, cancellationToken);
                    return game != null ? Results.Ok(game) : Results.NotFound();
                })
                .WithName(nameof(GetActa))
                .WithTags("Teams")
                .Produces<MatchRffm>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }
    }
}
