using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.News;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.News
{
    public class GetNewsById : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/coach/news/{id}",
                    async (string id, IMediator mediator, CancellationToken ct) =>
                    {
                        var result = await mediator.Send(new GetNewsByIdQuery(id), ct);
                        return result is null ? Results.NotFound() : Results.Ok(result);
                    })
                .WithName(nameof(GetNewsById))
                .WithTags(NewsConstants.NewsFeature)
                .RequireAuthorization()
                .Produces<NewsDetailResponse>()
                .Produces(StatusCodes.Status404NotFound);
        }
    }

    public record GetNewsByIdQuery(string Id) : IRequest<NewsDetailResponse?>;

    public class GetNewsByIdHandler : IRequestHandler<GetNewsByIdQuery, NewsDetailResponse?>
    {
        private readonly AppDbContext _db;
        private readonly ICurrentUserService _currentUser;

        public GetNewsByIdHandler(AppDbContext db, ICurrentUserService currentUser)
        {
            _db = db;
            _currentUser = currentUser;
        }

        public async ValueTask<NewsDetailResponse?> Handle(GetNewsByIdQuery request, CancellationToken ct = default)
        {
            var news = await _db.News.AsNoTracking().FirstOrDefaultAsync(n => n.Id == request.Id, ct);
            if (news is null)
                return null;

            if (news.Status == NewsStatus.Draft)
            {
                var roles = _currentUser.Roles ?? Array.Empty<string>();
                var canSeeDraft = roles.Any(r =>
                    string.Equals(r, "Coach", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(r, "Administrator", StringComparison.OrdinalIgnoreCase));
                if (!canSeeDraft)
                    return null;
            }

            return new NewsDetailResponse(
                news.Id, news.Title, news.Subtitle, news.Body, news.CoverImageUrl,
                news.Status.Name, news.PublishedAt, news.NewsDate, news.CreatedAt, news.UpdatedAt,
                news.LinkType.Name, news.LinkedEventId, news.LinkedTeamId, news.LinkUrl);
        }
    }
}
