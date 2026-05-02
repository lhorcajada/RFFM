using EasyCaching.Core;
using FluentValidation;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Rivals.Commands
{
    public class CreateRival : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/rivals",
                    async (CreateRivalRequest req, AppDbContext db,
                        IEasyCachingProviderFactory cachingFactory,
                        CancellationToken cancellationToken) =>
                    {
                        var rival = new Rival(req.Name, req.UrlPhoto, req.Category);
                        db.Rivals.Add(rival);
                        await db.SaveChangesAsync(cancellationToken);

                        var cache = cachingFactory.GetCachingProvider(Cache.CacheDefaultName);
                        await cache.RemoveAsync("Rivals", cancellationToken);

                        return Results.Ok(new RivalSaveResponse(rival.Id, rival.Name, rival.UrlPhoto, rival.Category));
                    })
                .WithName(nameof(CreateRival))
                .WithTags("Rivals")
                .Produces<RivalSaveResponse>()
                .Produces(StatusCodes.Status400BadRequest);
        }
    }

    public record CreateRivalRequest(string Name, string? UrlPhoto, string? Category);

    public class CreateRivalValidator : AbstractValidator<CreateRivalRequest>
    {
        public CreateRivalValidator()
        {
            RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        }
    }

    public record RivalSaveResponse(string Id, string Name, string? UrlPhoto, string? Category);
}
