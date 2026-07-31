using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Mobile.PushNotifications
{
    public class UpdatePushPreferences : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPatch("/api/mobile/push-tokens/{deviceId}/preferences",
                    async (string deviceId, UpdatePushPreferencesRequest body, IMediator mediator, CancellationToken ct) =>
                    {
                        var command = new UpdatePushPreferencesCommand
                        {
                            DeviceId = deviceId,
                            NewsEnabled = body.NewsEnabled,
                            CalendarEnabled = body.CalendarEnabled
                        };
                        await mediator.Send(command, ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(UpdatePushPreferences))
                .WithTags("PushNotifications")
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }

        public record UpdatePushPreferencesRequest(bool NewsEnabled, bool CalendarEnabled);

        public record UpdatePushPreferencesCommand : IRequest<Unit>
        {
            public string DeviceId { get; set; } = null!;
            public bool NewsEnabled { get; set; }
            public bool CalendarEnabled { get; set; }
        }

        public class Validator : AbstractValidator<UpdatePushPreferencesCommand>
        {
            public Validator()
            {
                RuleFor(x => x.DeviceId).NotEmpty().WithMessage("El identificador de dispositivo es obligatorio.");
            }
        }

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<UpdatePushPreferencesCommand, Unit>
        {
            public async ValueTask<Unit> Handle(UpdatePushPreferencesCommand request, CancellationToken cancellationToken)
            {
                var existing = await db.PushTokens.FirstOrDefaultAsync(
                    p => p.UserId == currentUser.UserId && p.DeviceId == request.DeviceId,
                    cancellationToken);

                if (existing is null)
                    throw new NotFoundException("Dispositivo no registrado.", ErrorCodes.PushTokenNotFound);

                existing.UpdatePreferences(request.NewsEnabled, request.CalendarEnabled);
                await db.SaveChangesAsync(cancellationToken);

                return Unit.Value;
            }
        }
    }
}
