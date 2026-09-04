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
    /// GET /api/coach/news?pageNumber=&amp;pageSize=&amp;descending= — published-only, sorted NewsDate ASC/DESC,
    /// open to any authenticated role. Cached (never contains drafts, so caching is safe across
    /// all roles).
    /// </summary>
    public class GetNews : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/coach/news",
                    async (int pageNumber, int pageSize, bool descending, IMediator mediator, CancellationToken ct) =>
                    {
                        var result = await mediator.Send(new GetNewsQuery(pageNumber, pageSize, descending), ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetNews))
                .WithTags(NewsConstants.NewsFeature)
                .RequireAuthorization()
                .Produces<NewsSummaryResponse[]>();
        }
    }

    public record GetNewsQuery(int PageNumber, int PageSize, bool Descending = false) : IRequest<NewsSummaryResponse[]>, ICacheRequest
    {
        public string CacheKey => $"{NewsConstants.PublishedListCachePrefix}{PageNumber}:{PageSize}:{Descending}";
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

            var ordered = request.Descending
                ? query.OrderByDescending(n => n.NewsDate)
                : query.OrderBy(n => n.NewsDate);

            var items = await ordered
                .Skip((request.PageNumber - 1) * request.PageSize)
                .Take(request.PageSize)
                .Select(n => new NewsSummaryResponse(
                    n.Id, n.Title, n.Subtitle, n.CoverImageUrl, n.Status.Name, n.PublishedAt, n.NewsDate,
                    n.LinkType.Name, n.LinkedEventId, n.LinkedTeamId, n.LinkUrl))
                .ToArrayAsync(ct);

            return items;
        }
    }
}

public record NewsSummaryResponse(
    string Id, string Title, string Subtitle, string CoverImageUrl, string Status, DateTime? PublishedAt, DateTime NewsDate,
    string LinkType, string? LinkedEventId, string? LinkedTeamId, string? LinkUrl);

public record NewsDetailResponse(
    string Id, string Title, string Subtitle, string Body, string CoverImageUrl,
    string Status, DateTime? PublishedAt, DateTime NewsDate, DateTime CreatedAt, DateTime UpdatedAt,
    string LinkType, string? LinkedEventId, string? LinkedTeamId, string? LinkUrl);
