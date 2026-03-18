using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Storage;

namespace RFFM.Api.Features.Coaches.Players.Commands
{
    public class UploadPlayerPhoto : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/catalog/player/photo",
                    async (IFormFile file, [FromServices] IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var command = new UploadPlayerPhotoCommand { File = file };
                        var result = await mediator.Send(command, cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(UploadPlayerPhoto))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .DisableAntiforgery();
        }
    }

    public class UploadPlayerPhotoCommand : IRequest<UploadPlayerPhotoResult>
    {
        public IFormFile File { get; set; }
    }

    public class UploadPlayerPhotoResult
    {
        public string Url { get; set; }
    }

    public class UploadPlayerPhotoHandler : IRequestHandler<UploadPlayerPhotoCommand, UploadPlayerPhotoResult>
    {
        private readonly IStorageService _storageService;

        public UploadPlayerPhotoHandler(IStorageService storageService)
        {
            _storageService = storageService;
        }

        public async ValueTask<UploadPlayerPhotoResult> Handle(UploadPlayerPhotoCommand request, CancellationToken cancellationToken)
        {
            if (request.File == null || request.File.Length == 0)
                throw new ArgumentException("File is invalid.");

            var fileName = Guid.NewGuid() + Path.GetExtension(request.File.FileName);

            var url = await _storageService.UploadAsync(PlayerConstants.PlayersContainerName, fileName, request.File, cancellationToken);

            return new UploadPlayerPhotoResult
            {
                Url = url
            };
        }
    }

    public class UploadPlayerPhotoValidator : AbstractValidator<UploadPlayerPhotoCommand>
    {
        public UploadPlayerPhotoValidator()
        {
            RuleFor(r => r.File)
                .NotNull()
                .Must(file => file.Length > 0)
                .WithMessage("File cannot be empty.");

            RuleFor(r => r.File.ContentType)
                .Must(contentType => contentType == "image/jpeg" || contentType == "image/png")
                .WithMessage("Only JPEG and PNG files are allowed.");

            RuleFor(r => r.File.FileName)
                .NotEmpty()
                .WithMessage("File name cannot be empty.");
        }
    }
}
