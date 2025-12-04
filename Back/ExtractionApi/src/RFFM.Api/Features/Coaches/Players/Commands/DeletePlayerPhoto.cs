using Azure.Storage.Blobs;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;

namespace RFFM.Api.Features.Coaches.Players.Commands
{
    public class DeletePlayerPhoto : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("api/catalog/player/photo",
                    async ([FromQuery] string blobName, [FromServices] IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var command = new DeletePlayerPhotoCommand { BlobName = blobName };
                        var result = await mediator.Send(command, cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(DeletePlayerPhoto))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .DisableAntiforgery();
        }
    }

    public class DeletePlayerPhotoCommand : IRequest<DeletePlayerPhotoResult>
    {
        public string BlobName { get; set; }
    }

    public class DeletePlayerPhotoResult
    {
        public bool IsDeleted { get; set; }
    }

    public class DeletePlayerPhotoHandler : IRequestHandler<DeletePlayerPhotoCommand, DeletePlayerPhotoResult>
    {
        private readonly BlobServiceClient _blobServiceClient;

        public DeletePlayerPhotoHandler(BlobServiceClient blobServiceClient)
        {
            _blobServiceClient = blobServiceClient;
        }

        public async ValueTask<DeletePlayerPhotoResult> Handle(DeletePlayerPhotoCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.BlobName))
                throw new ArgumentException("Blob name is invalid.");

            var containerClient = _blobServiceClient.GetBlobContainerClient(PlayerConstants.PlayersContainerName);

            var blobClient = containerClient.GetBlobClient(request.BlobName);

            var deleteResult = await blobClient.DeleteIfExistsAsync(cancellationToken: cancellationToken);

            return new DeletePlayerPhotoResult
            {
                IsDeleted = deleteResult
            };
        }
    }

    public class DeletePlayerPhotoValidator : AbstractValidator<DeletePlayerPhotoCommand>
    {
        public DeletePlayerPhotoValidator()
        {
            RuleFor(r => r.BlobName)
                .NotEmpty()
                .WithMessage("Blob name cannot be empty.");
        }
    }
}
