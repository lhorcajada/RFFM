using RFFM.Api.Infrastructure.Storage;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
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

    public class CreateTeamCommand : IRequest, IInvalidateCacheRequest, IRequireFeaturePermission
    {
        public string Name { get; set; } = null!;
        public int CategoryId { get; set; }
        public int? LeagueId { get; set; }
        public string ClubId { get; set; }
        public IFormFile? PhotoFile { get; set; }
        public string SeasonId { get; set; }
        public int? LeagueGroup { get; set; }
        public int? RffmCompetitionId { get; set; }
        public int? RffmGroupId { get; set; }

        public string PrefixCacheKey => TeamConstants.CachePrefix;
        public string FeatureRoute => CoachFeatureRoutes.ClubTeams;
        public string RequiredPermission => "ReadWrite";
    }

    public class CreateTeamHandler : IRequestHandler<CreateTeamCommand, Unit>
    {
        private readonly AppDbContext _catalogDbContext;
        private readonly IStorageService _storageService;

        public CreateTeamHandler(AppDbContext catalogDbContext, IStorageService storageService)
        {
            _catalogDbContext = catalogDbContext;
            _storageService = storageService;
        }
        public async ValueTask<Unit> Handle(CreateTeamCommand request, CancellationToken cancellationToken)
        {
            string? urlPhoto = null;

            if (request.PhotoFile != null && request.PhotoFile.Length > 0)
            {
                // Use the uploaded file name (not the multipart field name) to preserve extension.
                var fileName = Guid.NewGuid() + Path.GetExtension(request.PhotoFile.FileName);
                urlPhoto = await _storageService.UploadAsync(TeamConstants.TeamsContainerName, fileName, request.PhotoFile, cancellationToken);
            }
            var team = new Team(new TeamModel
            {
                Name = request.Name,
                ClubId = request.ClubId,
                CategoryId = request.CategoryId,
                LeagueId = request.LeagueId,
                SeasonId = request.SeasonId,
                UrlPhoto = urlPhoto,
                LeagueGroup = request.LeagueGroup,
                RffmCompetitionId = request.RffmCompetitionId,
                RffmGroupId = request.RffmGroupId
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
