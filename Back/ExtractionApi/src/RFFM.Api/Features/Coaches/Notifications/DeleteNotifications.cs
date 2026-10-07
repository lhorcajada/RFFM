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
    /// <summary>
    /// DELETE /api/notifications — deletes the given notifications of the calling user. Ids that do not
    /// exist or belong to another user are ignored. Returns how many were deleted.
    /// </summary>
    public class DeleteNotifications : IFeatureModule
    {
        public const int MaxIdsPerRequest = 100;

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/api/notifications",
                    async ([FromBody] DeleteNotificationsCommand command, IMediator mediator, CancellationToken ct) =>
                    {
                        var deleted = await mediator.Send(command, ct);
                        return Results.Ok(new DeleteNotificationsResponse(deleted));
                    })
                .WithName(nameof(DeleteNotifications))
                .WithTags("Notifications")
                .Produces<DeleteNotificationsResponse>()
                .ProducesValidationProblem()
                .RequireAuthorization();
        }

        public record DeleteNotificationsCommand(string[] Ids) : IRequest<int>;

        public record DeleteNotificationsResponse(int Deleted);

        public class Validator : AbstractValidator<DeleteNotificationsCommand>
        {
            public Validator()
            {
                RuleFor(c => c.Ids)
                    .NotEmpty()
                    .Must(ids => ids.Length <= MaxIdsPerRequest)
                    .WithMessage($"No se pueden eliminar más de {MaxIdsPerRequest} notificaciones a la vez.");
            }
        }

        public class Handler : IRequestHandler<DeleteNotificationsCommand, int>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<int> Handle(DeleteNotificationsCommand request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                var notifications = await _db.Notifications
                    .Where(n => n.UserId == userId && request.Ids.Contains(n.Id))
                    .ToListAsync(cancellationToken);

                _db.Notifications.RemoveRange(notifications);
                await _db.SaveChangesAsync(cancellationToken);

                return notifications.Count;
            }
        }
    }
}
