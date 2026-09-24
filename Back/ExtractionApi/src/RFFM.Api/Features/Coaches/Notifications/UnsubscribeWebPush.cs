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

namespace RFFM.Api.Features.Coaches.Notifications
{
    public class UnsubscribeWebPush : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/api/push/subscriptions",
                    async ([FromBody] UnsubscribeWebPushCommand command, IMediator mediator, CancellationToken ct) =>
                    {
                        await mediator.Send(command, ct);
                        return Results.Ok();
                    })
                .WithName(nameof(UnsubscribeWebPush))
                .WithTags("Notifications")
                .Produces(StatusCodes.Status200OK)
                .RequireAuthorization();
        }

        public record UnsubscribeWebPushCommand(string Endpoint) : IRequest<Unit>;

        public class Handler : IRequestHandler<UnsubscribeWebPushCommand, Unit>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<Unit> Handle(UnsubscribeWebPushCommand request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                var subscription = await _db.WebPushSubscriptions
                    .FirstOrDefaultAsync(s => s.Endpoint == request.Endpoint && s.UserId == userId, cancellationToken);

                if (subscription is not null)
                {
                    _db.WebPushSubscriptions.Remove(subscription);
                    await _db.SaveChangesAsync(cancellationToken);
                }

                return Unit.Value;
            }
        }

        public class Validator : AbstractValidator<UnsubscribeWebPushCommand>
        {
            public Validator()
            {
                RuleFor(x => x.Endpoint).NotEmpty();
            }
        }
    }
}
