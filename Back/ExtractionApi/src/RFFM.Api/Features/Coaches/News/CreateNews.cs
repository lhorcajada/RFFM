using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Entities.News;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.News
{
    public class CreateNews : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/coach/news",
                    async (CreateNewsCommand command, IMediator mediator, CancellationToken ct) =>
                    {
                        var id = await mediator.Send(command, ct);
                        return Results.Created($"/api/coach/news/{id}", new { id });
                    })
                .WithName(nameof(CreateNews))
                .WithTags(NewsConstants.NewsFeature)
                .WithMetadata(new AuthorizeAttribute { Roles = "Coach,Administrator" })
                .RequireAuthorization()
                .Produces(StatusCodes.Status201Created)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }
    }

    public record CreateNewsCommand(string Title, string Subtitle, string Body, string CoverImageUrl, string Status)
        : IRequest<string>, IInvalidateCacheRequest
    {
        public string PrefixCacheKey => NewsConstants.PublishedListCachePrefix;
    }

    public class CreateNewsHandler : IRequestHandler<CreateNewsCommand, string>
    {
        private readonly AppDbContext _db;
        public CreateNewsHandler(AppDbContext db) => _db = db;

        public async ValueTask<string> Handle(CreateNewsCommand request, CancellationToken ct = default)
        {
            NewsStatus.TryParseName(request.Status, out var status);
            var news = NewsItem.Create(request.Title, request.Subtitle, request.Body, request.CoverImageUrl, status!);

            await _db.News.AddAsync(news, ct);
            await _db.SaveChangesAsync(ct);
            return news.Id;
        }
    }

    public class CreateNewsValidator : AbstractValidator<CreateNewsCommand>
    {
        public CreateNewsValidator()
        {
            RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
            RuleFor(x => x.Subtitle).NotEmpty().MaximumLength(300);
            RuleFor(x => x.Body).NotEmpty();
            RuleFor(x => x.CoverImageUrl).NotEmpty();
            RuleFor(x => x.Status)
                .Must(s => s is "Draft" or "Published")
                .WithMessage("Status must be Draft or Published.");
        }
    }
}
