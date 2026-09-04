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
    public class UnpublishNews : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/coach/news/{id}/unpublish",
                    async (string id, IMediator mediator, CancellationToken ct) =>
                    {
                        var result = await mediator.Send(new UnpublishNewsCommand(id), ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(UnpublishNews))
                .WithTags(NewsConstants.NewsFeature)
                .WithMetadata(new AuthorizeAttribute { Roles = "Coach,Administrator" })
                .RequireAuthorization()
                .Produces<NewsDetailResponse>()
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public record UnpublishNewsCommand(string Id) : IRequest<NewsDetailResponse>, IInvalidateCacheRequest
    {
        public string PrefixCacheKey => NewsConstants.PublishedListCachePrefix;
    }

    public class UnpublishNewsHandler : IRequestHandler<UnpublishNewsCommand, NewsDetailResponse>
    {
        private readonly AppDbContext _db;
        public UnpublishNewsHandler(AppDbContext db)
        {
            _db = db;
        }

        public async ValueTask<NewsDetailResponse> Handle(UnpublishNewsCommand request, CancellationToken ct = default)
        {
            var news = await _db.News.FirstOrDefaultAsync(n => n.Id == request.Id, ct);
            if (news is null)
                throw new NotFoundException("Noticia no encontrada.", ErrorCodes.NewsNotFound);

            news.Unpublish();
            await _db.SaveChangesAsync(ct);

            return new NewsDetailResponse(
                news.Id, news.Title, news.Subtitle, news.Body, news.CoverImageUrl,
                news.Status.Name, news.PublishedAt, news.NewsDate, news.CreatedAt, news.UpdatedAt,
                news.LinkType.Name, news.LinkedEventId, news.LinkedTeamId, news.LinkUrl);
        }
    }
}
