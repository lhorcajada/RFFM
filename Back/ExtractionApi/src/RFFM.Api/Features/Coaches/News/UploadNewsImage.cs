using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Storage;

namespace RFFM.Api.Features.Coaches.News
{
    public class UploadNewsImage : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/coach/news/image",
                    async (IFormFile file, IMediator mediator, CancellationToken ct) =>
                    {
                        var result = await mediator.Send(new UploadNewsImageCommand { File = file }, ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(UploadNewsImage))
                .WithTags(NewsConstants.NewsFeature)
                .WithMetadata(new AuthorizeAttribute { Roles = "Coach,Administrator" })
                .RequireAuthorization()
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .DisableAntiforgery();
        }
    }

    public class UploadNewsImageCommand : IRequest<UploadNewsImageResult>
    {
        public IFormFile File { get; set; } = null!;
    }

    public class UploadNewsImageResult
    {
        public string Url { get; set; } = null!;
    }

    public class UploadNewsImageHandler : IRequestHandler<UploadNewsImageCommand, UploadNewsImageResult>
    {
        private readonly IStorageService _storageService;

        public UploadNewsImageHandler(IStorageService storageService)
        {
            _storageService = storageService;
        }

        public async ValueTask<UploadNewsImageResult> Handle(UploadNewsImageCommand request, CancellationToken ct)
        {
            if (request.File == null || request.File.Length == 0)
                throw new ArgumentException("El archivo no es válido.");

            var fileName = Guid.NewGuid() + Path.GetExtension(request.File.FileName);
            var url = await _storageService.UploadAsync(NewsConstants.ImagesContainerName, fileName, request.File, ct);

            return new UploadNewsImageResult { Url = url };
        }
    }

    public class UploadNewsImageValidator : AbstractValidator<UploadNewsImageCommand>
    {
        public UploadNewsImageValidator()
        {
            RuleFor(r => r.File)
                .NotNull()
                .WithMessage("El archivo es obligatorio.");

            // Both rules below select r.File itself (not r.File.ContentType/r.File.Length) so the
            // property accessor never dereferences a null File — FluentValidation evaluates the
            // property-selector expression to build the rule context even when .When() would skip
            // the validator, so RuleFor(r => r.File.ContentType) throws NRE for a null File
            // regardless of a .When(r => r.File is not null) guard on that same rule.
            RuleFor(r => r.File)
                .Must(file => file != null && file.Length > 0)
                .WithMessage("El archivo no puede estar vacío.");

            RuleFor(r => r.File)
                .Must(file => file != null && (file.ContentType == "image/jpeg" || file.ContentType == "image/png"))
                .WithMessage("Solo se permiten archivos JPEG y PNG.");
        }
    }
}
