using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.PushNotifications;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Mobile.PushNotifications
{
    public class RegisterPushToken : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/mobile/push-tokens",
                    async (RegisterPushTokenRequest body, IMediator mediator, CancellationToken ct) =>
                    {
                        var command = new RegisterPushTokenCommand
                        {
                            DeviceId = body.DeviceId,
                            ExpoPushToken = body.ExpoPushToken,
                            Platform = body.Platform
                        };
                        await mediator.Send(command, ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(RegisterPushToken))
                .WithTags("PushNotifications")
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }

        public record RegisterPushTokenRequest(string DeviceId, string ExpoPushToken, string Platform);

        public record RegisterPushTokenCommand : IRequest<Unit>
        {
            public string DeviceId { get; set; } = null!;
            public string ExpoPushToken { get; set; } = null!;
            public string Platform { get; set; } = null!;
        }

        public class Validator : AbstractValidator<RegisterPushTokenCommand>
        {
            public Validator()
            {
                RuleFor(x => x.DeviceId).NotEmpty().WithMessage("El identificador de dispositivo es obligatorio.");
                RuleFor(x => x.ExpoPushToken).NotEmpty().WithMessage("El token de push es obligatorio.");
                RuleFor(x => x.Platform).NotEmpty().WithMessage("La plataforma es obligatoria.");
            }
        }

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<RegisterPushTokenCommand, Unit>
        {
            public async ValueTask<Unit> Handle(RegisterPushTokenCommand request, CancellationToken cancellationToken)
            {
                var existing = await db.PushTokens.FirstOrDefaultAsync(
                    p => p.UserId == currentUser.UserId && p.DeviceId == request.DeviceId,
                    cancellationToken);

                if (existing is not null)
                {
                    existing.UpdateToken(request.ExpoPushToken);
                }
                else
                {
                    var token = PushToken.Create(currentUser.UserId!, request.DeviceId, request.ExpoPushToken, request.Platform);
                    db.PushTokens.Add(token);
                }

                await db.SaveChangesAsync(cancellationToken);

                return Unit.Value;
            }
        }
    }
}
