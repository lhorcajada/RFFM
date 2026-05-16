using System.Security.Claims;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Seasons.Commands
{
    public class CreateSeason : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/catalog/season",
                    static async (CreateSeasonCommand command, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        await mediator.Send(command, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(CreateSeason))
                .WithTags(SeasonConstants.SeasonFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public class CreateSeasonCommand : RFFM.Api.Common.ICommand, IInvalidateCacheRequest
    {
        public string SeasonName { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public bool IsActive { get; set; }
        public string ClubId { get; set; } = string.Empty;

        public string PrefixCacheKey => SeasonConstants.CachePrefix;
    }

    public class CreateSeasonHandler : IRequestHandler<CreateSeasonCommand, Unit>
    {
        private readonly AppDbContext _catalogDbContext;

        public CreateSeasonHandler(AppDbContext catalogDbContext)
        {
            _catalogDbContext = catalogDbContext;
        }
        public async ValueTask<Unit> Handle(CreateSeasonCommand request, CancellationToken cancellationToken)
        {
            if (request.IsActive)
            {
                var activeSeasons = await _catalogDbContext.Seasons
                    .Where(season => season.IsActive)
                    .ToListAsync(cancellationToken);

                foreach (var activeSeason in activeSeasons)
                {
                    activeSeason.UpdateIsActive(false);
                }
            }


            var club = await _catalogDbContext.Clubs
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == request.ClubId, cancellationToken: cancellationToken);
            if (club == null)
                throw new KeyNotFoundException($"Club '{request.ClubId}' Not Found");

            var season = Season.Create(request.SeasonName, request.StartDate, request.EndDate, request.IsActive, club);
            await _catalogDbContext.Seasons.AddAsync(season, cancellationToken);
            await _catalogDbContext.SaveChangesAsync(cancellationToken);
            return Unit.Value;

        }
    }
    public class CreateValidator : AbstractValidator<CreateSeasonCommand>
    {
        public CreateValidator()
        {
            RuleFor(r => r.SeasonName)
                .NotEmpty()
                .MaximumLength(ValidationConstants.SeasonNameMaxLength);

            RuleFor(r => r.StartDate)
                .NotEmpty();

            RuleFor(r => r.EndDate)
                .NotEmpty()
                .GreaterThanOrEqualTo(r => r.StartDate)
                .WithMessage(ValidationConstants.SeasonEndDateCannotBeBeforeStartDate);
           RuleFor(r => r.EndDate)
               .Must((command, endDate) => endDate > DateTime.UtcNow)
               .WithMessage(ValidationConstants.SeasonEndDateCannotBeInThePast);
           RuleFor(r => r.StartDate)
               .Must((command, startDate) => startDate <= DateTime.UtcNow)
               .WithMessage(ValidationConstants.SeasonStartDateCannotBeInThePast);
           RuleFor(r => r.ClubId)
               .NotEmpty()
               .MaximumLength(ValidationConstants.ClubIdMaxLength);



        }
    }


}
