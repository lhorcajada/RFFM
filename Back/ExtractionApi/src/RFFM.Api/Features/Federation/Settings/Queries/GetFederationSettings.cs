using System.Security.Claims;
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
                    async (IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        // If authenticated, use user's settings
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                        if (!string.IsNullOrEmpty(userId))
                        {
                            var query = new GetUserFederationSettingsQuery(userId);
                            var result = await mediator.Send(query, cancellationToken);
                            return Results.Ok(result);
                        }

                        var allQuery = new GetFederationSettingsQuery();
                        var allResult = await mediator.Send(allQuery, cancellationToken);
                        return Results.Ok(allResult);
                    })
                .WithName(nameof(GetFederationSettings))
                .WithTags(FederationSettingsConstants.FederationSettingsFeature)
                .Produces<List<FederationSettingResponse>>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .RequireAuthorization();
        }
    }

    public record GetFederationSettingsQuery() : IRequest<List<FederationSettingResponse>>;
    public record GetUserFederationSettingsQuery(string UserId) : IRequest<List<FederationSettingResponse>>;

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

    public class GetUserFederationSettingsHandler : IRequestHandler<GetUserFederationSettingsQuery, List<FederationSettingResponse>>
    {
        private readonly IFederationSettingService _service;

        public GetUserFederationSettingsHandler(IFederationSettingService service)
        {
            _service = service;
        }

        public async ValueTask<List<FederationSettingResponse>> Handle(GetUserFederationSettingsQuery request, CancellationToken cancellationToken)
        {
            var settings = await _service.GetUserSettingsAsync(request.UserId, cancellationToken);
            return settings.Select(FederationSettingMapping.ToResponse).ToList();
        }
    }
}
