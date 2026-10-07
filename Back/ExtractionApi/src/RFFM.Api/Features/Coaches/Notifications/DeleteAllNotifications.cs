using FluentValidation;
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
    /// DELETE /api/notifications/all?app=coach|federation — deletes every notification of the calling user
    /// that belongs to the given app. Returns how many were deleted.
    /// </summary>
    public class DeleteAllNotifications : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/api/notifications/all",
                    async (string? app, IMediator mediator, CancellationToken ct) =>
                    {
                        var deleted = await mediator.Send(new DeleteAllNotificationsCommand(app), ct);
                        return Results.Ok(new DeleteAllNotificationsResponse(deleted));
                    })
                .WithName(nameof(DeleteAllNotifications))
                .WithTags("Notifications")
                .Produces<DeleteAllNotificationsResponse>()
                .ProducesValidationProblem()
                .RequireAuthorization();
        }

        public record DeleteAllNotificationsCommand(string? App) : IRequest<int>;

        public record DeleteAllNotificationsResponse(int Deleted);

        public class Validator : AbstractValidator<DeleteAllNotificationsCommand>
        {
            public Validator()
            {
                RuleFor(c => c.App)
                    .Must(app => app?.ToLowerInvariant() is NotificationApps.Coach or NotificationApps.Federation)
                    .WithMessage("Debe indicarse la aplicación (coach o federation).");
            }
        }

        public class Handler : IRequestHandler<DeleteAllNotificationsCommand, int>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<int> Handle(DeleteAllNotificationsCommand request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                return await _db.Notifications
                    .Where(n => n.UserId == userId)
                    .ForApp(request.App)
                    .ExecuteDeleteAsync(cancellationToken);
            }
        }
    }
}
