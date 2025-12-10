using System.Security.Claims;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Features.Federation.Settings.Models;
using RFFM.Api.Features.Federation.Settings.Services;
using RFFM.Api.FeatureModules;

namespace RFFM.Api.Features.Federation.Settings.Commands
{
    public class SetPrimaryFederationSetting : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/federation/settings/{id}/primary",
                    async (string id, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                        var cmd = new SetPrimaryFederationSettingCommand(id, userId);
                        var result = await mediator.Send(cmd, cancellationToken);
                        
                        return Results.Ok(result);
                    })
                .WithName(nameof(SetPrimaryFederationSetting))
                .WithTags(FederationSettingsConstants.FederationSettingsFeature)
                .Produces<FederationSettingResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status404NotFound)
                .RequireAuthorization();
        }
    }

    public record SetPrimaryFederationSettingCommand(string Id, string UserId) 
        : IRequest<FederationSettingResponse>;

    public class SetPrimaryFederationSettingHandler : IRequestHandler<SetPrimaryFederationSettingCommand, FederationSettingResponse>
    {
        private readonly IFederationSettingService _service;

        public SetPrimaryFederationSettingHandler(IFederationSettingService service)
        {
            _service = service;
        }

        public async ValueTask<FederationSettingResponse> Handle(SetPrimaryFederationSettingCommand request, CancellationToken cancellationToken)
        {
            await _service.SetPrimaryAsync(request.Id, request.UserId, cancellationToken);
            var setting = await _service.GetByIdAsync(request.Id, cancellationToken);
            return FederationSettingMapping.ToResponse(setting!);
        }
    }
}
