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

namespace RFFM.Api.Features.Coaches.Players.Commands
{
    public class DeletePlayer : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("api/catalog/player/{id}",
                    async (string id, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var request = new DeletePlayerCommand()
                        {
                            PlayerId = id
                        };
                        await mediator.Send(request, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(DeletePlayer))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public class DeletePlayerCommand : IRequest, IInvalidateCacheRequest
    {
        public string PlayerId { get; set; } = string.Empty;
        public string PrefixCacheKey => PlayerConstants.CachePrefix;
    }

    public class DeletePlayerHandler : IRequestHandler<DeletePlayerCommand, Unit>
    {
        private readonly AppDbContext _catalogDbContext;

        public DeletePlayerHandler(AppDbContext catalogDbContext)
        {
            _catalogDbContext = catalogDbContext;
        }
        public async ValueTask<Unit> Handle(DeletePlayerCommand request, CancellationToken cancellationToken)
        {
            var player = await _catalogDbContext.Players
                .FirstOrDefaultAsync(c => c.Id == request.PlayerId, cancellationToken: cancellationToken);
            if (player == null)
                throw new KeyNotFoundException($"Player '{request.PlayerId}' Not Found");

            _catalogDbContext.Players.Remove(player);
            await _catalogDbContext.SaveChangesAsync(cancellationToken);
            return Unit.Value;

        }
    }
    public class DeletePlayerValidator : AbstractValidator<DeletePlayerCommand>
    {
        public DeletePlayerValidator()
        {
            RuleFor(r => r.PlayerId)
                .NotEmpty();

        }
    }
}
