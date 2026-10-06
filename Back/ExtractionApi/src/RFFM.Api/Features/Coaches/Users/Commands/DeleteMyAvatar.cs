using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Storage;

namespace RFFM.Api.Features.Coaches.Users.Commands
{
    /// <summary>
    /// Quita la foto de avatar del usuario autenticado. Idempotente.
    /// DELETE /api/users/me/avatar
    /// </summary>
    public class DeleteMyAvatar : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("api/users/me/avatar",
                    async (IMediator mediator, HttpContext httpContext, CancellationToken ct) =>
                    {
                        var userId = CurrentUser.GetId(httpContext.User);
                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        await mediator.Send(new Command(userId), ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteMyAvatar))
                .WithTags(UserConstants.UserFeature)
                .Produces(StatusCodes.Status204NoContent)
                .RequireAuthorization();
        }

        public record Command(string UserId) : IRequest;

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(x => x.UserId).NotEmpty();
            }
        }

        public class Handler(AppDbContext db, IStorageService storage, ILogger<Handler> logger) : IRequestHandler<Command>
        {
            public async ValueTask<Unit> Handle(Command request, CancellationToken cancellationToken)
            {
                var data = await db.UserPersonalData
                    .FirstOrDefaultAsync(p => p.ApplicationUserId == request.UserId, cancellationToken);

                var previousUrl = data?.RemoveAvatar();
                if (previousUrl is null)
                    return Unit.Value;

                await db.SaveChangesAsync(cancellationToken);
                await AvatarFiles.TryDeleteAsync(storage, previousUrl, logger, cancellationToken);

                return Unit.Value;
            }
        }
    }
}
