using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Storage;

namespace RFFM.Api.Features.Coaches.Rivals.Commands
{
    public class UploadRivalPhoto : IFeatureModule
    {
        public const string RivalsContainerName = "rivalphotos";

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/rivals/photo",
                    async (IFormFile file, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var command = new UploadRivalPhotoCommand { File = file };
                        var result = await mediator.Send(command, cancellationToken);
                        return result == null ? Results.BadRequest("File is invalid.") : Results.Ok(new UploadRivalPhotoResult { Url = result });
                    })
                .WithName(nameof(UploadRivalPhoto))
                .WithTags("Rivals")
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .RequireAuthorization()
                .DisableAntiforgery();
        }
    }

    public record UploadRivalPhotoCommand : IRequest<string?>, IRequireFeaturePermission
    {
        public IFormFile? File { get; set; }

        public string FeatureRoute => CoachFeatureRoutes.Rivals;
        public string RequiredPermission => "ReadWrite";
    }

    public class UploadRivalPhotoHandler : IRequestHandler<UploadRivalPhotoCommand, string?>
    {
        private readonly IStorageService _storageService;

        public UploadRivalPhotoHandler(IStorageService storageService)
        {
            _storageService = storageService;
        }

        public async ValueTask<string?> Handle(UploadRivalPhotoCommand request, CancellationToken cancellationToken)
        {
            if (request.File == null || request.File.Length == 0)
                return null;

            var fileName = Guid.NewGuid() + System.IO.Path.GetExtension(request.File.FileName);
            var url = await _storageService.UploadAsync(UploadRivalPhoto.RivalsContainerName, fileName, request.File, cancellationToken);

            return url;
        }
    }

    public class UploadRivalPhotoValidator : AbstractValidator<UploadRivalPhotoCommand>
    {
        public UploadRivalPhotoValidator()
        {
            RuleFor(x => x.File)
                .NotNull()
                .Custom((file, context) =>
                {
                    if (file?.Length == 0)
                        context.AddFailure("File is invalid.");
                });
        }
    }

    public class UploadRivalPhotoResult
    {
        public string Url { get; set; } = null!;
    }
}
