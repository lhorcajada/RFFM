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

namespace RFFM.Api.Features.Coaches.Seasons.Commands
{
    public class UpdateSeason : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("api/catalog/season/{id}",
                    async (string id, UpdateSeasonCommand command,  IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        command.SeasonId = id;
                        await mediator.Send(command, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(UpdateSeason))
                .WithTags(SeasonConstants.SeasonFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public class UpdateSeasonCommand : RFFM.Api.Common.ICommand, IInvalidateCacheRequest
    {
        public string SeasonId { get; set; } = string.Empty;
        public string SeasonName { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public bool IsActive { get; set; }
        public string PrefixCacheKey => SeasonConstants.CachePrefix;
    }

    public class UpdateDeleteSeasonHandler : IRequestHandler<UpdateSeasonCommand, Unit>
    {
        private readonly AppDbContext _catalogDbContext;

        public UpdateDeleteSeasonHandler(AppDbContext catalogDbContext)
        {
            _catalogDbContext = catalogDbContext;
        }
        public async ValueTask<Unit> Handle(UpdateSeasonCommand request, CancellationToken cancellationToken)
        {
            var season = await _catalogDbContext.Seasons
                .FirstOrDefaultAsync(c => c.Id == request.SeasonId, cancellationToken: cancellationToken);
            if (season == null)
                throw new KeyNotFoundException($"Season '{request.SeasonId}' Not Found");

            season.UpdateName(request.SeasonName);
            season.UpdatePeriod(request.StartDate, request.EndDate);

            if (request.IsActive)
            {
                var activeSeasons = await _catalogDbContext.Seasons
                    .Where(c => c.IsActive && c.Id != season.Id)
                    .ToListAsync(cancellationToken);

                foreach (var activeSeason in activeSeasons)
                {
                    activeSeason.UpdateIsActive(false);
                }
            }

            season.UpdateIsActive(request.IsActive);

            await _catalogDbContext.SaveChangesAsync(cancellationToken);
            return Unit.Value;

        }
    }
    public class UpdateSeasonValidator : AbstractValidator<UpdateSeasonCommand>
    {
        public UpdateSeasonValidator()
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

        }
    }


}
