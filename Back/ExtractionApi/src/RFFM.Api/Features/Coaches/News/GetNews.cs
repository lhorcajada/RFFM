using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Entities.News;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.News
{
    /// <summary>
    /// GET /api/coach/news?pageNumber=&amp;pageSize= — published-only, sorted PublishedAt DESC,
    /// open to any authenticated role. Cached (never contains drafts, so caching is safe across
    /// all roles).
    /// </summary>
    public class GetNews : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/coach/news",
                    async (int pageNumber, int pageSize, IMediator mediator, CancellationToken ct) =>
                    {
                        var result = await mediator.Send(new GetNewsQuery(pageNumber, pageSize), ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetNews))
                .WithTags(NewsConstants.NewsFeature)
                .RequireAuthorization()
                .Produces<NewsSummaryResponse[]>();
        }
    }

    public record GetNewsQuery(int PageNumber, int PageSize) : IRequest<NewsSummaryResponse[]>, ICacheRequest
    {
        public string CacheKey => $"{NewsConstants.PublishedListCachePrefix}{PageNumber}:{PageSize}";
        public DateTime? AbsoluteExpirationRelativeToNow => null;
    }

    public class GetNewsHandler : IRequestHandler<GetNewsQuery, NewsSummaryResponse[]>
    {
        private readonly AppDbContext _db;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public GetNewsHandler(AppDbContext db, IHttpContextAccessor httpContextAccessor)
        {
            _db = db;
            _httpContextAccessor = httpContextAccessor;
        }

        public async ValueTask<NewsSummaryResponse[]> Handle(GetNewsQuery request, CancellationToken ct = default)
        {
            var query = _db.News.AsNoTracking().Where(n => n.Status == NewsStatus.Published);

            var total = await query.CountAsync(ct);
            try
            {
                _httpContextAccessor.HttpContext!.Response.Headers["X-Total-Count"] = total.ToString();
            }
            catch
            {
                // ignore if no http context available (e.g. unit tests calling the handler directly)
            }

            var items = await query
                .OrderByDescending(n => n.PublishedAt)
                .Skip((request.PageNumber - 1) * request.PageSize)
                .Take(request.PageSize)
                .Select(n => new NewsSummaryResponse(n.Id, n.Title, n.Subtitle, n.CoverImageUrl, n.Status.Name, n.PublishedAt))
                .ToArrayAsync(ct);

            return items;
        }
    }
}

public record NewsSummaryResponse(string Id, string Title, string Subtitle, string CoverImageUrl, string Status, DateTime? PublishedAt);

public record NewsDetailResponse(
    string Id, string Title, string Subtitle, string Body, string CoverImageUrl,
    string Status, DateTime? PublishedAt, DateTime CreatedAt, DateTime UpdatedAt);
