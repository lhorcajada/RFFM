using Azure.Storage.Blobs;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;

namespace RFFM.Api.Features.Coaches.Teams.Commands
{
    public class UploadTeamPhoto : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/catalog/team/photo",
                    async (IFormFile file, [FromServices] IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var command = new UploadTeamPhotoCommand { File = file };
                        var result = await mediator.Send(command, cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(UploadTeamPhoto))
                .WithTags(TeamConstants.TeamFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .DisableAntiforgery();
        }
    }

    public class UploadTeamPhotoCommand : IRequest<UploadTeamPhotoResult>
    {
        public IFormFile File { get; set; }
    }

    public class UploadTeamPhotoResult
    {
        public string Url { get; set; }
    }

    public class UploadTeamPhotoHandler : IRequestHandler<UploadTeamPhotoCommand, UploadTeamPhotoResult>
    {
        private readonly BlobServiceClient _blobServiceClient;

        public UploadTeamPhotoHandler(BlobServiceClient blobServiceClient)
        {
            _blobServiceClient = blobServiceClient;
        }

        public async ValueTask<UploadTeamPhotoResult> Handle(UploadTeamPhotoCommand request, CancellationToken cancellationToken)
        {
            if (request.File == null || request.File.Length == 0)
                throw new ArgumentException("File is invalid.");

            var containerClient = _blobServiceClient.GetBlobContainerClient(TeamConstants.TeamsContainerName);

            await containerClient.CreateIfNotExistsAsync(cancellationToken: cancellationToken);

            var fileName = Guid.NewGuid() + Path.GetExtension(request.File.FileName);

            var blobClient = containerClient.GetBlobClient(fileName);

            await using var stream = request.File.OpenReadStream();
            await blobClient.UploadAsync(stream, cancellationToken);

            return new UploadTeamPhotoResult
            {
                Url = blobClient.Uri.ToString()
            };
        }
    }

    public class UploadTeamPhotoValidator : AbstractValidator<UploadTeamPhotoCommand>
    {
        public UploadTeamPhotoValidator()
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
