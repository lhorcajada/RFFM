using System.Security.Claims;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Domain.Entities.Federation;
using RFFM.Api.Features.Federation.Settings.Models;
using RFFM.Api.Features.Federation.Settings.Services;
using RFFM.Api.FeatureModules;

namespace RFFM.Api.Features.Federation.Settings.Commands
{
    public class SaveFederationSetting : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/federation/settings",
                    async (SaveFederationSettingRequest request, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                        var cmd = new SaveFederationSettingCommand(userId, request);
                        var result = await mediator.Send(cmd, cancellationToken);
                        
                        return Results.Created($"/federation/settings/{result.Id}", result);
                    })
                .WithName(nameof(SaveFederationSetting))
                .WithTags(FederationSettingsConstants.FederationSettingsFeature)
                .Produces<FederationSettingResponse>(StatusCodes.Status201Created)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .RequireAuthorization();
        }
    }

    public record SaveFederationSettingCommand(string UserId, SaveFederationSettingRequest Request) 
        : IRequest<FederationSettingResponse>;

    public class SaveFederationSettingHandler : IRequestHandler<SaveFederationSettingCommand, FederationSettingResponse>
    {
        private readonly IFederationSettingService _service;

        public SaveFederationSettingHandler(IFederationSettingService service)
        {
            _service = service;
        }

        public async ValueTask<FederationSettingResponse> Handle(SaveFederationSettingCommand request, CancellationToken cancellationToken)
        {
            var setting = new FederationSetting(
                request.UserId,
                request.Request.CompetitionId,
                request.Request.CompetitionName,
                request.Request.GroupId,
                request.Request.GroupName,
                request.Request.TeamId,
                request.Request.TeamName,
                request.Request.IsPrimary);

            var created = await _service.CreateAsync(setting, cancellationToken);
            return FederationSettingMapping.ToResponse(created);
        }
    }
}
