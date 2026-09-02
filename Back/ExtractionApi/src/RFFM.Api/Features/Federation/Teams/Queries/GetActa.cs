using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Options;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Features.Federation.Teams.Services;
using RFFM.Api.Infrastructure.Options;

namespace RFFM.Api.Features.Federation.Teams.Queries
{
    public class FederationGetActa : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/acta/{codActa}", async (IActaService actaService, IOptions<RffmOptions> rffmOptions, CancellationToken cancellationToken,
                    string codActa = "5440937", int? temporada = null, int competicion = 25255269, int grupo = 25255283) =>
                {
                    var resolvedTemporada = temporada ?? rffmOptions.Value.CurrentSeasonId;
                    var game = await actaService.GetMatchFromActaAsync(codActa, resolvedTemporada, competicion, grupo, cancellationToken);
                    return game != null ? Results.Ok(game) : Results.NotFound();
                })
                .WithName(nameof(FederationGetActa))
                .WithTags(TeamsConstants.TeamsFeature)
                .Produces<MatchRffm>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }
    }
}
