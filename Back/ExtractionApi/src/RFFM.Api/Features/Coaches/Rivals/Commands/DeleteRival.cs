using EasyCaching.Core;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Rivals.Commands
{
    public class DeleteRival : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/api/rivals/{id}",
                async (string id, AppDbContext db, IEasyCachingProviderFactory cachingFactory, CancellationToken cancellationToken) =>
                {
                    var rival = await db.Rivals.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
                    if (rival is null) return Results.NotFound();

                    // If rival is used in any sport event, prevent deletion
                    var usedInEvent = await db.SportEvents.AnyAsync(e => e.RivalId == id, cancellationToken);
                    if (usedInEvent)
                    {
                        return Results.Conflict(new { Message = "El rival está siendo usado en algún evento y no puede eliminarse." });
                    }

                    db.Rivals.Remove(rival);
                    await db.SaveChangesAsync(cancellationToken);

                    var cache = cachingFactory.GetCachingProvider(Cache.CacheDefaultName);
                    await cache.RemoveAsync("Rivals", cancellationToken);

                    return Results.NoContent();
                })
                .WithName(nameof(DeleteRival))
                .WithTags("Rivals")
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status404NotFound)
                .Produces(StatusCodes.Status409Conflict);
        }
    }
}
