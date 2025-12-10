using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Features.Federation.Settings.Services;
using RFFM.Api.FeatureModules;

namespace RFFM.Api.Features.Federation.Settings.Commands
{
    public class DeleteFederationSetting : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/federation/settings/{id}",
                    async (string id, string? userId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var cmd = new DeleteFederationSettingCommand(id);
                        await mediator.Send(cmd, cancellationToken);
                        
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteFederationSetting))
                .WithTags(FederationSettingsConstants.FederationSettingsFeature)
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status404NotFound);
        }
    }

    public record DeleteFederationSettingCommand(string Id) 
        : IRequest;

    public class DeleteFederationSettingHandler : IRequestHandler<DeleteFederationSettingCommand>
    {
        private readonly IFederationSettingService _service;

        public DeleteFederationSettingHandler(IFederationSettingService service)
        {
            _service = service;
        }

        public async ValueTask<Unit> Handle(DeleteFederationSettingCommand request, CancellationToken cancellationToken)
        {
            var existing = await _service.GetByIdAsync(request.Id, cancellationToken);
            if (existing == null)
                throw new InvalidOperationException($"Setting con id {request.Id} no encontrado");

            await _service.DeleteAsync(request.Id, cancellationToken);
            return Unit.Value;
        }
    }
}
