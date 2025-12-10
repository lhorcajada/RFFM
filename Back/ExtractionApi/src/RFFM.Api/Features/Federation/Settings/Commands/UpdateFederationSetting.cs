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
                    async (string id, string? userId, SaveFederationSettingRequest request, 
                           IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var cmd = new UpdateFederationSettingCommand(id, request);
                        var result = await mediator.Send(cmd, cancellationToken);
                        
                        return Results.Ok(result);
                    })
                .WithName(nameof(UpdateFederationSetting))
                .WithTags(FederationSettingsConstants.FederationSettingsFeature)
                .Produces<FederationSettingResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status404NotFound);
        }
    }

    public record UpdateFederationSettingCommand(string Id, SaveFederationSettingRequest Request) 
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

            var updatedSetting = new FederationSetting(
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
