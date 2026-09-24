using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Notifications
{
    public class MarkNotificationRead : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/notifications/{id}/read",
                    async (string id, IMediator mediator, CancellationToken ct) =>
                    {
                        await mediator.Send(new MarkNotificationReadCommand(id), ct);
                        return Results.Ok();
                    })
                .WithName(nameof(MarkNotificationRead))
                .WithTags("Notifications")
                .Produces(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status404NotFound)
                .RequireAuthorization();
        }

        public record MarkNotificationReadCommand(string Id) : IRequest<Unit>;

        public class Handler : IRequestHandler<MarkNotificationReadCommand, Unit>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<Unit> Handle(MarkNotificationReadCommand request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                var notification = await _db.Notifications
                    .FirstOrDefaultAsync(n => n.Id == request.Id && n.UserId == userId, cancellationToken);

                if (notification is null)
                    throw new NotFoundException("Notificación no encontrada.", ErrorCodes.NotificationNotFound);

                notification.MarkAsRead();
                await _db.SaveChangesAsync(cancellationToken);

                return Unit.Value;
            }
        }
    }
}
