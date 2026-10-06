using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Storage;

namespace RFFM.Api.Features.Coaches.Users.Commands
{
    /// <summary>
    /// Sube la foto de avatar del usuario autenticado y sustituye la anterior.
    /// POST /api/users/me/avatar (multipart <c>file</c>)
    /// </summary>
    public class UploadMyAvatar : IFeatureModule
    {
        public const long MaxFileBytes = 2 * 1024 * 1024;
        private static readonly string[] AllowedContentTypes = ["image/jpeg", "image/png", "image/webp"];

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/users/me/avatar",
                    async (IFormFile file, IMediator mediator, HttpContext httpContext, CancellationToken ct) =>
                    {
                        var userId = CurrentUser.GetId(httpContext.User);
                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        return Results.Ok(await mediator.Send(new Command { UserId = userId, File = file }, ct));
                    })
                .WithName(nameof(UploadMyAvatar))
                .WithTags(UserConstants.UserFeature)
                .Produces<Response>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .RequireAuthorization()
                .DisableAntiforgery();
        }

        public record Command : IRequest<Response>
        {
            public string UserId { get; init; } = string.Empty;
            public IFormFile File { get; init; } = null!;
        }

        public record Response(string AvatarUrl);

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(x => x.File).NotNull();
                When(x => x.File is not null, () =>
                {
                    RuleFor(x => x.File.Length).GreaterThan(0).LessThanOrEqualTo(MaxFileBytes);
                    RuleFor(x => x.File.ContentType)
                        .Must(contentType => AllowedContentTypes.Contains(contentType))
                        .WithMessage("Solo se admiten imágenes JPEG, PNG o WebP.");
                });
            }
        }

        public class Handler(AppDbContext db, IStorageService storage, ILogger<Handler> logger)
            : IRequestHandler<Command, Response>
        {
            public async ValueTask<Response> Handle(Command request, CancellationToken cancellationToken)
            {
                var data = await db.UserPersonalData
                               .FirstOrDefaultAsync(p => p.ApplicationUserId == request.UserId, cancellationToken)
                           ?? throw new DomainException("UserPersonalData",
                               "Guarda primero tus datos personales.", ErrorCodes.PersonalDataRequired);

                var path = $"{request.UserId}/{Guid.NewGuid()}{Path.GetExtension(request.File.FileName)}";
                var url = await storage.UploadAsync(UserConstants.AvatarsContainerName, path, request.File, cancellationToken);

                var previousUrl = data.AvatarUrl;
                data.SetAvatar(url);
                await db.SaveChangesAsync(cancellationToken);

                if (previousUrl is not null)
                    await AvatarFiles.TryDeleteAsync(storage, previousUrl, logger, cancellationToken);

                return new Response(url);
            }
        }
    }

    internal static class AvatarFiles
    {
        public static async Task TryDeleteAsync(IStorageService storage, string url, ILogger logger, CancellationToken cancellationToken)
        {
            var path = UserConstants.AvatarPathFromUrl(url);
            if (path is null)
                return;

            try
            {
                await storage.DeleteAsync(UserConstants.AvatarsContainerName, path, cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "No se pudo borrar el avatar {Path}", path);
            }
        }
    }
}
