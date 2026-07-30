using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.News
{
    public class DeleteNews : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/api/coach/news/{id}",
                    async (string id, IMediator mediator, CancellationToken ct) =>
                    {
                        await mediator.Send(new DeleteNewsCommand(id), ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteNews))
                .WithTags(NewsConstants.NewsFeature)
                .WithMetadata(new AuthorizeAttribute { Roles = "Coach,Administrator" })
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }
    }

    public record DeleteNewsCommand(string Id) : IRequest<Unit>, IInvalidateCacheRequest
    {
        public string PrefixCacheKey => NewsConstants.PublishedListCachePrefix;
    }

    public class DeleteNewsHandler : IRequestHandler<DeleteNewsCommand, Unit>
    {
        private readonly AppDbContext _db;
        public DeleteNewsHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(DeleteNewsCommand request, CancellationToken ct = default)
        {
            var news = await _db.News.FirstOrDefaultAsync(n => n.Id == request.Id, ct);
            if (news is null)
                throw new NotFoundException("Noticia no encontrada.", ErrorCodes.NewsNotFound);

            _db.News.Remove(news);
            await _db.SaveChangesAsync(ct);
            return Unit.Value;
        }
    }
}
