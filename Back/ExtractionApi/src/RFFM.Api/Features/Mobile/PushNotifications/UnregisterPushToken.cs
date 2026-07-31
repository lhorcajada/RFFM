using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Mobile.PushNotifications
{
    public class UnregisterPushToken : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/api/mobile/push-tokens/{deviceId}",
                    async (string deviceId, IMediator mediator, CancellationToken ct) =>
                    {
                        await mediator.Send(new UnregisterPushTokenCommand { DeviceId = deviceId }, ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(UnregisterPushToken))
                .WithTags("PushNotifications")
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }

        public record UnregisterPushTokenCommand : IRequest<Unit>
        {
            public string DeviceId { get; set; } = null!;
        }

        public class Validator : AbstractValidator<UnregisterPushTokenCommand>
        {
            public Validator()
            {
                RuleFor(x => x.DeviceId).NotEmpty().WithMessage("El identificador de dispositivo es obligatorio.");
            }
        }

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<UnregisterPushTokenCommand, Unit>
        {
            public async ValueTask<Unit> Handle(UnregisterPushTokenCommand request, CancellationToken cancellationToken)
            {
                var existing = await db.PushTokens.FirstOrDefaultAsync(
                    p => p.UserId == currentUser.UserId && p.DeviceId == request.DeviceId,
                    cancellationToken);

                if (existing is not null)
                {
                    db.PushTokens.Remove(existing);
                    await db.SaveChangesAsync(cancellationToken);
                }

                return Unit.Value;
            }
        }
    }
}
