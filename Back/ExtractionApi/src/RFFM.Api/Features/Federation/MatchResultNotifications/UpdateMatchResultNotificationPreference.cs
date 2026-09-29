using System.Security.Claims;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.Federation.MatchResultNotifications;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Federation.MatchResultNotifications
{
    /// <summary>PUT /api/match-result-notifications/preference — activa o desactiva los avisos de resultados (idempotente).</summary>
    public class UpdateMatchResultNotificationPreference : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/match-result-notifications/preference",
                    async (UpdateMatchResultNotificationPreferenceBody body, IMediator mediator, HttpContext httpContext,
                        CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                        await mediator.Send(new UpdateMatchResultNotificationPreferenceCommand(userId, body.Enabled), cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(UpdateMatchResultNotificationPreference))
                .WithTags("Notifications")
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ValidationProblemDetails>(StatusCodes.Status400BadRequest)
                .RequireAuthorization();
        }

        public record UpdateMatchResultNotificationPreferenceBody(bool? Enabled);

        public record UpdateMatchResultNotificationPreferenceCommand(string UserId, bool? Enabled) : Common.ICommand;

        public class Validator : AbstractValidator<UpdateMatchResultNotificationPreferenceCommand>
        {
            public Validator()
            {
                RuleFor(x => x.UserId).NotEmpty();
                RuleFor(x => x.Enabled).NotNull();
            }
        }

        public class Handler(FederationDbContext db, TimeProvider timeProvider)
            : IRequestHandler<UpdateMatchResultNotificationPreferenceCommand, Unit>
        {
            public async ValueTask<Unit> Handle(UpdateMatchResultNotificationPreferenceCommand request, CancellationToken cancellationToken)
            {
                var existing = await db.MatchResultNotificationOptOuts
                    .FirstOrDefaultAsync(o => o.UserId == request.UserId, cancellationToken);

                var wantsNotifications = request.Enabled == true;
                if (wantsNotifications && existing != null)
                    db.MatchResultNotificationOptOuts.Remove(existing);
                else if (!wantsNotifications && existing == null)
                    db.MatchResultNotificationOptOuts.Add(
                        MatchResultNotificationOptOut.Create(request.UserId, timeProvider.GetUtcNow().UtcDateTime));

                await db.SaveChangesAsync(cancellationToken);
                return Unit.Value;
            }
        }
    }
}
