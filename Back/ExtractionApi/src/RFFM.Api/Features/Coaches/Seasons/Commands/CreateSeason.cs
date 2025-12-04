using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
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
                    async (CreateSeasonCommand command, IMediator mediator, CancellationToken cancellationToken) =>
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

    public class CreateSeasonCommand : IRequest, IInvalidateCacheRequest
    {
        public string Name { get; set; } = string.Empty;
        public bool IsActive { get; set; }
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
            var season = new Season(request.Name, request.IsActive);
            await _catalogDbContext.Seasons.AddAsync(season, cancellationToken);
            await _catalogDbContext.SaveChangesAsync(cancellationToken);
            return Unit.Value;

        }
    }
    public class CreateValidator : AbstractValidator<CreateSeasonCommand>
    {
        public CreateValidator()
        {
            RuleFor(r => r.Name)
                .NotEmpty()
                .MaximumLength(ValidationConstants.SeasonNameMaxLength);
           

        }
    }


}
