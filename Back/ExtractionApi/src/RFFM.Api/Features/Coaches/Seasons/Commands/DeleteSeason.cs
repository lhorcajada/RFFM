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
    public class DeleteSeason : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("api/catalog/season/{id}",
                    async (string id, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var request = new DeleteSeasonCommand()
                        {
                            SeasonId = id
                        };
                        await mediator.Send(request, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(DeleteSeason))
                .WithTags(SeasonConstants.SeasonFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public class DeleteSeasonCommand : IRequest, IInvalidateCacheRequest
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
