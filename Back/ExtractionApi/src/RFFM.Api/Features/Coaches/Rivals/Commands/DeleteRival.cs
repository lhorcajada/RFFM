using EasyCaching.Core;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Rivals.Commands
{
    public class DeleteRival : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/api/rivals/{id}",
                async (string id, IMediator mediator, CancellationToken cancellationToken) =>
                {
                    var command = new DeleteRivalCommand { Id = id };
                    var result = await mediator.Send(command, cancellationToken);
                    return result.Success
                        ? (result.Conflict ? Results.Conflict(new { Message = result.Message }) : Results.NoContent())
                        : Results.NotFound();
                })
                .WithName(nameof(DeleteRival))
                .WithTags("Rivals")
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status404NotFound)
                .Produces(StatusCodes.Status409Conflict)
                .RequireAuthorization();
        }
    }

    public record DeleteRivalCommand : IRequest<DeleteRivalResult>, IInvalidateCacheRequest, IRequireFeaturePermission
    {
        public string Id { get; set; } = string.Empty;

        public string PrefixCacheKey => "Rivals";
        public string FeatureRoute => CoachFeatureRoutes.Rivals;
        public string RequiredPermission => "ReadWrite";
    }

    public record DeleteRivalResult(bool Success, bool Conflict = false, string Message = "");

    public class DeleteRivalHandler : IRequestHandler<DeleteRivalCommand, DeleteRivalResult>
    {
        private readonly AppDbContext _db;
        private readonly IEasyCachingProviderFactory _cachingFactory;

        public DeleteRivalHandler(AppDbContext db, IEasyCachingProviderFactory cachingFactory)
        {
            _db = db;
            _cachingFactory = cachingFactory;
        }

        public async ValueTask<DeleteRivalResult> Handle(DeleteRivalCommand request, CancellationToken cancellationToken)
        {
            var rival = await _db.Rivals.FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);
            if (rival is null) return new DeleteRivalResult(false);

            // If rival is used in any sport event, prevent deletion
            var usedInEvent = await _db.SportEvents.AnyAsync(e => e.RivalId == request.Id, cancellationToken);
            if (usedInEvent)
            {
                return new DeleteRivalResult(
                    true,
                    Conflict: true,
                    Message: "El rival está siendo usado en algún evento y no puede eliminarse.");
            }

            _db.Rivals.Remove(rival);
            await _db.SaveChangesAsync(cancellationToken);

            var cache = _cachingFactory.GetCachingProvider(Cache.CacheDefaultName);
            await cache.RemoveAsync("Rivals", cancellationToken);

            return new DeleteRivalResult(true);
        }
    }
}
