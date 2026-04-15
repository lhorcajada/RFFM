using EasyCaching.Core;
using FluentValidation;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Rivals.Commands
{
    public class UpdateRival : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/rivals/{id}",
                    async (string id, UpdateRivalRequest req, AppDbContext db,
                        IEasyCachingProviderFactory cachingFactory,
                        CancellationToken cancellationToken) =>
                    {
                        var rival = await db.Rivals.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
                        if (rival is null) return Results.NotFound();

                        rival.SetName(req.Name);
                        rival.SetUrlPhoto(req.UrlPhoto);
                        await db.SaveChangesAsync(cancellationToken);

                        var cache = cachingFactory.GetCachingProvider(Cache.CacheDefaultName);
                        await cache.RemoveAsync("Rivals", cancellationToken);

                        return Results.Ok(new RivalSaveResponse(rival.Id, rival.Name, rival.UrlPhoto));
                    })
                .WithName(nameof(UpdateRival))
                .WithTags("Rivals")
                .Produces<RivalSaveResponse>()
                .Produces(StatusCodes.Status404NotFound);
        }
    }

    public record UpdateRivalRequest(string Name, string? UrlPhoto);

    public class UpdateRivalValidator : AbstractValidator<UpdateRivalRequest>
    {
        public UpdateRivalValidator()
        {
            RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        }
    }
}
