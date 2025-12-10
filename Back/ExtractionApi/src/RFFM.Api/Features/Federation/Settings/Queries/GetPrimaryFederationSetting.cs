using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Features.Federation.Settings.Models;
using RFFM.Api.Features.Federation.Settings.Services;
using RFFM.Api.FeatureModules;

namespace RFFM.Api.Features.Federation.Settings.Queries
{
    public class GetPrimaryFederationSetting : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/federation/settings/primary",
                    async (string? userId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var query = new GetPrimaryFederationSettingQuery();
                        var result = await mediator.Send(query, cancellationToken);
                        
                        return result != null ? Results.Ok(result) : Results.NoContent();
                    })
                .WithName(nameof(GetPrimaryFederationSetting))
                .WithTags(FederationSettingsConstants.FederationSettingsFeature)
                .Produces<FederationSettingResponse>(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }
    }

    public record GetPrimaryFederationSettingQuery() : IRequest<FederationSettingResponse?>;

    public class GetPrimaryFederationSettingHandler : IRequestHandler<GetPrimaryFederationSettingQuery, FederationSettingResponse?>
    {
        private readonly IFederationSettingService _service;

        public GetPrimaryFederationSettingHandler(IFederationSettingService service)
        {
            _service = service;
        }

        public async ValueTask<FederationSettingResponse?> Handle(GetPrimaryFederationSettingQuery request, CancellationToken cancellationToken)
        {
            var setting = await _service.GetPrimarySettingAsync(cancellationToken);
            return setting != null ? FederationSettingMapping.ToResponse(setting) : null;
        }
    }
}
