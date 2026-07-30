using FluentValidation;
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
    public class UpdateNews : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/coach/news/{id}",
                    async (string id, UpdateNewsCommand command, IMediator mediator, CancellationToken ct) =>
                    {
                        await mediator.Send(command with { Id = id }, ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(UpdateNews))
                .WithTags(NewsConstants.NewsFeature)
                .WithMetadata(new AuthorizeAttribute { Roles = "Coach,Administrator" })
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }
    }

    public record UpdateNewsCommand(string Title, string Subtitle, string Body, string CoverImageUrl)
        : IRequest<Unit>, IInvalidateCacheRequest
    {
        public string Id { get; init; } = string.Empty;
        public string PrefixCacheKey => NewsConstants.PublishedListCachePrefix;
    }

    public class UpdateNewsHandler : IRequestHandler<UpdateNewsCommand, Unit>
    {
        private readonly AppDbContext _db;
        public UpdateNewsHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(UpdateNewsCommand request, CancellationToken ct = default)
        {
            var news = await _db.News.FirstOrDefaultAsync(n => n.Id == request.Id, ct);
            if (news is null)
                throw new NotFoundException("Noticia no encontrada.", ErrorCodes.NewsNotFound);

            news.UpdateContent(request.Title, request.Subtitle, request.Body, request.CoverImageUrl);
            await _db.SaveChangesAsync(ct);
            return Unit.Value;
        }
    }

    public class UpdateNewsValidator : AbstractValidator<UpdateNewsCommand>
    {
        public UpdateNewsValidator()
        {
            RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
            RuleFor(x => x.Subtitle).NotEmpty().MaximumLength(300);
            RuleFor(x => x.Body).NotEmpty();
            RuleFor(x => x.CoverImageUrl).NotEmpty();
        }
    }
}
