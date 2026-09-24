using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.WebPushNotifications;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Notifications
{
    public class SubscribeWebPush : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/push/subscriptions",
                    async (SubscribeWebPushCommand command, IMediator mediator, CancellationToken ct) =>
                    {
                        await mediator.Send(command, ct);
                        return Results.Ok();
                    })
                .WithName(nameof(SubscribeWebPush))
                .WithTags("Notifications")
                .Produces(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status400BadRequest)
                .RequireAuthorization();
        }

        public record SubscribeWebPushCommand(string Endpoint, string P256dhKey, string AuthKey) : IRequest<Unit>;

        public class Handler : IRequestHandler<SubscribeWebPushCommand, Unit>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<Unit> Handle(SubscribeWebPushCommand request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                var existing = await _db.WebPushSubscriptions
                    .FirstOrDefaultAsync(s => s.Endpoint == request.Endpoint, cancellationToken);

                if (existing is not null)
                {
                    _db.WebPushSubscriptions.Remove(existing);
                }

                _db.WebPushSubscriptions.Add(
                    WebPushSubscription.Create(userId, request.Endpoint, request.P256dhKey, request.AuthKey));

                await _db.SaveChangesAsync(cancellationToken);
                return Unit.Value;
            }
        }

        public class Validator : AbstractValidator<SubscribeWebPushCommand>
        {
            public Validator()
            {
                RuleFor(x => x.Endpoint).NotEmpty();
                RuleFor(x => x.P256dhKey).NotEmpty();
                RuleFor(x => x.AuthKey).NotEmpty();
            }
        }
    }
}
