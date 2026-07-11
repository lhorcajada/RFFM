using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Seasons.Commands
{
    public class DeleteSeason : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("api/catalog/season/{id}",
                    async (string id, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        try
                        {
                            var request = new DeleteSeasonCommand()
                            {
                                SeasonId = id
                            };
                            await mediator.Send(request, cancellationToken);
                            return Results.Ok();
                        }
                        catch (DomainException exception) when (exception.Code == ErrorCodes.SeasonHasRelatedData)
                        {
                            return Results.Conflict(new ProblemDetails
                            {
                                Title = exception.Title,
                                Detail = exception.Description,
                                Extensions = { ["code"] = exception.Code }
                            });
                        }
                    })
                .WithName(nameof(DeleteSeason))
                .WithTags(SeasonConstants.SeasonFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public class DeleteSeasonCommand : RFFM.Api.Common.ICommand, IInvalidateCacheRequest
    {
        public string SeasonId { get; set; } = string.Empty;
        public string PrefixCacheKey => SeasonConstants.CachePrefix;
    }

    public class DeleteSeasonHandler : IRequestHandler<DeleteSeasonCommand, Unit>
    {
        private readonly AppDbContext _catalogDbContext;

        public DeleteSeasonHandler(AppDbContext catalogDbContext)
        {
            _catalogDbContext = catalogDbContext;
        }
        public async ValueTask<Unit> Handle(DeleteSeasonCommand request, CancellationToken cancellationToken)
        {
            var season = await _catalogDbContext.Seasons
                .FirstOrDefaultAsync(c => c.Id == request.SeasonId, cancellationToken: cancellationToken);
            if (season == null)
                throw new KeyNotFoundException($"Season '{request.SeasonId}' Not Found");

            var hasRelatedData = await _catalogDbContext.Teams.AnyAsync(team => team.SeasonId == season.Id, cancellationToken)
                || await _catalogDbContext.ClubKits.AnyAsync(kit => kit.SeasonId == season.Id, cancellationToken)
                || await _catalogDbContext.TeamIdealLineups.AnyAsync(lineup => lineup.SeasonId == season.Id, cancellationToken)
                || await _catalogDbContext.TrainingPointsReports.AnyAsync(report => report.SeasonId == season.Id, cancellationToken);

            if (hasRelatedData)
            {
                throw new DomainException(
                    "Temporadas",
                    "No se puede eliminar la temporada porque ya tiene datos relacionados.",
                    ErrorCodes.SeasonHasRelatedData);
            }

            _catalogDbContext.Seasons.Remove(season);
            await _catalogDbContext.SaveChangesAsync(cancellationToken);
            return Unit.Value;

        }
    }
    public class DeleteSeasonValidator : AbstractValidator<DeleteSeasonCommand>
    {
        public DeleteSeasonValidator()
        {
            RuleFor(r => r.SeasonId)
                .NotEmpty();
        }
    }


}
