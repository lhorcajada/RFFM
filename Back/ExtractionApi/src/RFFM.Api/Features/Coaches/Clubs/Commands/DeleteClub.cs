using Azure.Storage.Blobs;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Clubs.Commands
{
    public class DeleteClub : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("api/catalog/club/{id}",
                    async (string id, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var request = new DeleteClubCommand()
                        {
                            ClubId = id
                        };
                        await mediator.Send(request, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(DeleteClub))
                .WithTags(ClubConstants.ClubFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public class DeleteClubCommand : IRequest, IInvalidateCacheRequest
    {
        public string ClubId { get; set; } = string.Empty;
        public string PrefixCacheKey => ClubConstants.CachePrefix;
    }

    public class DeleteClubHandler : IRequestHandler<DeleteClubCommand, Unit>
    {
        private readonly AppDbContext _catalogDbContext;
        private readonly BlobServiceClient _blobServiceClient;

        public DeleteClubHandler(AppDbContext catalogDbContext, BlobServiceClient blobServiceClient)
        {
            _catalogDbContext = catalogDbContext;
            _blobServiceClient = blobServiceClient;
        }

        public async ValueTask<Unit> Handle(DeleteClubCommand request, CancellationToken cancellationToken)
        {
            var club = await _catalogDbContext.Clubs
                .FirstOrDefaultAsync(c => c.Id == request.ClubId, cancellationToken: cancellationToken);
            if (club == null)
                throw new KeyNotFoundException($"Club '{request.ClubId}' Not Found");

            // Eliminar la imagen del club si existe
            if (!string.IsNullOrEmpty(club.ShieldUrl))
            {
                var containerClient = _blobServiceClient.GetBlobContainerClient(ClubConstants.ClubsContainerName);
                var blobName = Path.GetFileName(new Uri(club.ShieldUrl).LocalPath);
                var blobClient = containerClient.GetBlobClient(blobName);

                await blobClient.DeleteIfExistsAsync(cancellationToken: cancellationToken);
            }

            // Eliminar el registro del club
            _catalogDbContext.Clubs.Remove(club);
            await _catalogDbContext.SaveChangesAsync(cancellationToken);

            return Unit.Value;
        }
    }

    public class DeleteClubValidator : AbstractValidator<DeleteClubCommand>
    {
        public DeleteClubValidator()
        {
            RuleFor(r => r.ClubId)
                .NotEmpty()
                .MaximumLength(ValidationConstants.ClubNameMaxLength);
        }
    }
}
