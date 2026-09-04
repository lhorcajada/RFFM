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
using RFFM.Api.Features.Mobile.PushNotifications;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.News
{
    public class PublishNews : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/coach/news/{id}/publish",
                    async (string id, IMediator mediator, CancellationToken ct) =>
                    {
                        var result = await mediator.Send(new PublishNewsCommand(id), ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(PublishNews))
                .WithTags(NewsConstants.NewsFeature)
                .WithMetadata(new AuthorizeAttribute { Roles = "Coach,Administrator" })
                .RequireAuthorization()
                .Produces<NewsDetailResponse>()
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public record PublishNewsCommand(string Id) : IRequest<NewsDetailResponse>, IInvalidateCacheRequest
    {
        public string PrefixCacheKey => NewsConstants.PublishedListCachePrefix;
    }

    public class PublishNewsHandler : IRequestHandler<PublishNewsCommand, NewsDetailResponse>
    {
        private readonly AppDbContext _db;
        private readonly IPushNotificationDispatcher _dispatcher;
        public PublishNewsHandler(AppDbContext db, IPushNotificationDispatcher dispatcher)
        {
            _db = db;
            _dispatcher = dispatcher;
        }

        public async ValueTask<NewsDetailResponse> Handle(PublishNewsCommand request, CancellationToken ct = default)
        {
            var news = await _db.News.FirstOrDefaultAsync(n => n.Id == request.Id, ct);
            if (news is null)
                throw new NotFoundException("Noticia no encontrada.", ErrorCodes.NewsNotFound);

            news.Publish();
            await _db.SaveChangesAsync(ct);

            await _dispatcher.DispatchNewsPublishedAsync(news.Id, ct);

            return new NewsDetailResponse(
                news.Id, news.Title, news.Subtitle, news.Body, news.CoverImageUrl,
                news.Status.Name, news.PublishedAt, news.NewsDate, news.CreatedAt, news.UpdatedAt,
                news.LinkType.Name, news.LinkedEventId, news.LinkedTeamId, news.LinkUrl);
        }
    }
}
