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
    public class GetFederationSettings : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/federation/settings",
                    async (string? userId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var query = new GetFederationSettingsQuery();
                        var result = await mediator.Send(query, cancellationToken);
                        
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetFederationSettings))
                .WithTags(FederationSettingsConstants.FederationSettingsFeature)
                .Produces<List<FederationSettingResponse>>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }
    }

    public record GetFederationSettingsQuery() : IRequest<List<FederationSettingResponse>>;

    public class GetFederationSettingsHandler : IRequestHandler<GetFederationSettingsQuery, List<FederationSettingResponse>>
    {
        private readonly IFederationSettingService _service;

        public GetFederationSettingsHandler(IFederationSettingService service)
        {
            _service = service;
        }

        public async ValueTask<List<FederationSettingResponse>> Handle(GetFederationSettingsQuery request, CancellationToken cancellationToken)
        {
            var settings = await _service.GetAllSettingsAsync(cancellationToken);
            return settings.Select(FederationSettingMapping.ToResponse).ToList();
        }
    }
}
