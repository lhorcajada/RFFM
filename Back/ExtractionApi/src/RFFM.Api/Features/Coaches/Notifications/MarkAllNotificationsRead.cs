using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Notifications
{
    /// <summary>
    /// POST /api/notifications/read?app=coach|federation — marks every unread notification of the calling
    /// user (optionally scoped to one app) as read. Returns how many were marked.
    /// </summary>
    public class MarkAllNotificationsRead : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/notifications/read",
                    async (string? app, IMediator mediator, CancellationToken ct) =>
                    {
                        var marked = await mediator.Send(new MarkAllNotificationsReadCommand(app), ct);
                        return Results.Ok(new MarkAllNotificationsReadResponse(marked));
                    })
                .WithName(nameof(MarkAllNotificationsRead))
                .WithTags("Notifications")
                .Produces<MarkAllNotificationsReadResponse>()
                .RequireAuthorization();
        }

        public record MarkAllNotificationsReadCommand(string? App) : IRequest<int>;

        public record MarkAllNotificationsReadResponse(int Marked);

        public class Handler : IRequestHandler<MarkAllNotificationsReadCommand, int>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<int> Handle(MarkAllNotificationsReadCommand request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                var unread = await _db.Notifications
                    .Where(n => n.UserId == userId && !n.IsRead)
                    .ForApp(request.App)
                    .ToListAsync(cancellationToken);

                foreach (var notification in unread)
                    notification.MarkAsRead();

                await _db.SaveChangesAsync(cancellationToken);

                return unread.Count;
            }
        }
    }
}
