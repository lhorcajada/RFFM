using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.News;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc.Authorization;

namespace RFFM.Api.Features.Coaches.News
{
    public class GetNewsDrafts : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/coach/news/drafts",
                    async (int pageNumber, int pageSize, IMediator mediator, CancellationToken ct) =>
                    {
                        var result = await mediator.Send(new GetNewsDraftsQuery(pageNumber, pageSize), ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetNewsDrafts))
                .WithTags(NewsConstants.NewsFeature)
                .WithMetadata(new AuthorizeAttribute { Roles = "Coach,Administrator" })
                .RequireAuthorization()
                .Produces<NewsSummaryResponse[]>();
        }
    }

    public record GetNewsDraftsQuery(int PageNumber, int PageSize) : IRequest<NewsSummaryResponse[]>;

    public class GetNewsDraftsHandler : IRequestHandler<GetNewsDraftsQuery, NewsSummaryResponse[]>
    {
        private readonly AppDbContext _db;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public GetNewsDraftsHandler(AppDbContext db, IHttpContextAccessor httpContextAccessor)
        {
            _db = db;
            _httpContextAccessor = httpContextAccessor;
        }

        public async ValueTask<NewsSummaryResponse[]> Handle(GetNewsDraftsQuery request, CancellationToken ct = default)
        {
            var query = _db.News.AsNoTracking().Where(n => n.Status == NewsStatus.Draft);

            var total = await query.CountAsync(ct);
            try
            {
                _httpContextAccessor.HttpContext!.Response.Headers["X-Total-Count"] = total.ToString();
            }
            catch
            {
                // ignore if no http context available
            }

            var items = await query
                .OrderByDescending(n => n.CreatedAt)
                .Skip((request.PageNumber - 1) * request.PageSize)
                .Take(request.PageSize)
                .Select(n => new NewsSummaryResponse(n.Id, n.Title, n.Subtitle, n.CoverImageUrl, n.Status.Name, n.PublishedAt))
                .ToArrayAsync(ct);

            return items;
        }
    }
}
