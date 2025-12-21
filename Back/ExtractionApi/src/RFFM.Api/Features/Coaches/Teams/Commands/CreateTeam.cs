using Azure.Storage.Blobs;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Models;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Teams.Commands
{
    public class CreateTeam : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/catalog/team",
                    async ([FromForm] CreateTeamCommand command, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        await mediator.Send(command, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(CreateTeam))
                .WithTags(TeamConstants.TeamFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict)
                .DisableAntiforgery(); 
        }
    }

    public class CreateTeamCommand : IRequest, IInvalidateCacheRequest
    {
        public string Name { get; set; } = null!;
        public int CategoryId { get; set; }
        public int? LeagueId { get; set; }
        public string ClubId { get; set; }
        public IFormFile? PhotoFile { get; set; }
        public string SeasonId { get; set; }
        public int? LeagueGroup { get; set; }

        public string PrefixCacheKey => TeamConstants.CachePrefix;
    }

    public class CreateTeamHandler : IRequestHandler<CreateTeamCommand, Unit>
    {
        private readonly AppDbContext _catalogDbContext;
        private readonly BlobServiceClient _blobServiceClient;

        public CreateTeamHandler(AppDbContext catalogDbContext, BlobServiceClient blobServiceClient)
        {
            _catalogDbContext = catalogDbContext;
            _blobServiceClient = blobServiceClient;
        }
        public async ValueTask<Unit> Handle(CreateTeamCommand request, CancellationToken cancellationToken)
        {
            string? urlPhoto = null;

            if (request.PhotoFile != null && request.PhotoFile.Length > 0)
            {
                var containerClient = _blobServiceClient.GetBlobContainerClient(TeamConstants.TeamsContainerName);
                await containerClient.CreateIfNotExistsAsync(cancellationToken: cancellationToken);

                var fileName = Guid.NewGuid() + Path.GetExtension(request.PhotoFile.Name);
                var blobClient = containerClient.GetBlobClient($"{fileName}");

                await using var stream = request.PhotoFile.OpenReadStream();
                await blobClient.UploadAsync(stream, cancellationToken);

                urlPhoto = blobClient.Uri.ToString();
            }
            var team = new Team(new TeamModel
            {
                Name = request.Name,
                ClubId = request.ClubId,
                CategoryId = request.CategoryId,
                LeagueId = request.LeagueId,
                SeasonId = request.SeasonId,
                UrlPhoto = urlPhoto,
                LeagueGroup = request.LeagueGroup
            });
            await _catalogDbContext.Teams.AddAsync(team, cancellationToken);
            await _catalogDbContext.SaveChangesAsync(cancellationToken);
            return Unit.Value;

        }
    }
    public class CreateValidator : AbstractValidator<CreateTeamCommand>
    {
        public CreateValidator()
        {
            RuleFor(r => r.Name)
                .NotEmpty()
                .MaximumLength(ValidationConstants.TeamNameMaxLength);

            RuleFor(r => r.CategoryId)
                .GreaterThan(0)
                .WithMessage(ValidationConstants.TeamCategoryIdMustBeGreaterThanZero);

            // SeasonId is required because the Teams table enforces a non-nullable SeasonId foreign key.
            RuleFor(r => r.SeasonId)
                .NotEmpty()
                .WithMessage("SeasonId is required.");
        }
    }

}
