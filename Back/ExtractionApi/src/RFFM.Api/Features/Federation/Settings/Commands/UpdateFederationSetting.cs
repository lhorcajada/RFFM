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
    public class UpdateFederationSetting : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/federation/settings/{id}",
                    async (string id, SaveFederationSettingRequest request, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                        var cmd = new UpdateFederationSettingCommand(id, userId, request);
                        var result = await mediator.Send(cmd, cancellationToken);
                        
                        return Results.Ok(result);
                    })
                .WithName(nameof(UpdateFederationSetting))
                .WithTags(FederationSettingsConstants.FederationSettingsFeature)
                .Produces<FederationSettingResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status404NotFound)
                .RequireAuthorization();
        }
    }

    public record UpdateFederationSettingCommand(string Id, string UserId, SaveFederationSettingRequest Request) 
        : IRequest<FederationSettingResponse>;

    public class UpdateFederationSettingHandler : IRequestHandler<UpdateFederationSettingCommand, FederationSettingResponse>
    {
        private readonly IFederationSettingService _service;

        public UpdateFederationSettingHandler(IFederationSettingService service)
        {
            _service = service;
        }

        public async ValueTask<FederationSettingResponse> Handle(UpdateFederationSettingCommand request, CancellationToken cancellationToken)
        {
            var existing = await _service.GetByIdAsync(request.Id, cancellationToken);
            if (existing == null)
                throw new InvalidOperationException($"Setting con id {request.Id} no encontrado");

            if (existing.UserId != request.UserId)
                throw new InvalidOperationException("No tiene permiso para actualizar esta configuración");

            var updatedSetting = new FederationSetting(
                request.UserId,
                request.Request.CompetitionId,
                request.Request.CompetitionName,
                request.Request.GroupId,
                request.Request.GroupName,
                request.Request.TeamId,
                request.Request.TeamName,
                request.Request.IsPrimary);

            var updated = await _service.UpdateAsync(request.Id, updatedSetting, cancellationToken);
            return FederationSettingMapping.ToResponse(updated);
        }
    }
}
