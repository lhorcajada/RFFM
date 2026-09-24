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
    /// GET /api/notifications — paginated inbox of the calling user's own Notification rows only.
    /// Plain IRequest (not IQueryApp) so it is never cached across users (mirrors SearchAuditLog.cs).
    /// </summary>
    public class SearchNotifications : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/notifications",
                    async (
                        int pageNumber, int pageSize,
                        IMediator mediator, IHttpContextAccessor httpContextAccessor, CancellationToken ct) =>
                    {
                        var (items, total) = await mediator.Send(
                            new SearchNotificationsQuery(pageNumber == 0 ? 1 : pageNumber, pageSize == 0 ? 25 : pageSize), ct);

                        try
                        {
                            httpContextAccessor.HttpContext!.Response.Headers["X-Total-Count"] = total.ToString();
                        }
                        catch
                        {
                            // ignore if no http context available (e.g. unit tests calling the handler directly)
                        }

                        return Results.Ok(items);
                    })
                .WithName(nameof(SearchNotifications))
                .WithTags("Notifications")
                .Produces<NotificationResponse[]>()
                .RequireAuthorization();
        }

        public record SearchNotificationsQuery(int PageNumber = 1, int PageSize = 25) : IRequest<(NotificationResponse[], int)>;

        public record NotificationResponse(
            string Id, string Type, string Title, string Body, string? DeepLinkPath, bool IsRead, DateTime CreatedAt);

        public class Handler : IRequestHandler<SearchNotificationsQuery, (NotificationResponse[], int)>
        {
            private const int MaxPageSize = 100;
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<(NotificationResponse[], int)> Handle(SearchNotificationsQuery request, CancellationToken ct = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                var pageSize = Math.Min(Math.Max(request.PageSize, 1), MaxPageSize);
                var pageNumber = Math.Max(request.PageNumber, 1);

                var query = _db.Notifications.AsNoTracking().Where(n => n.UserId == userId);

                var total = await query.CountAsync(ct);

                var items = await query
                    .OrderByDescending(n => n.CreatedAt)
                    .Skip((pageNumber - 1) * pageSize)
                    .Take(pageSize)
                    .Select(n => new NotificationResponse(n.Id, n.Type, n.Title, n.Body, n.DeepLinkPath, n.IsRead, n.CreatedAt))
                    .ToArrayAsync(ct);

                return (items, total);
            }
        }
    }
}
