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
        private readonly IStorageService _storageService;

        public DeletePlayerPhotoHandler(IStorageService storageService)
        {
            _storageService = storageService;
        }

        public async ValueTask<DeletePlayerPhotoResult> Handle(DeletePlayerPhotoCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.BlobName))
                throw new ArgumentException("Blob name is invalid.");

            var isDeleted = await _storageService.DeleteAsync(PlayerConstants.PlayersContainerName, request.BlobName, cancellationToken);

            return new DeletePlayerPhotoResult
            {
                IsDeleted = isDeleted
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
