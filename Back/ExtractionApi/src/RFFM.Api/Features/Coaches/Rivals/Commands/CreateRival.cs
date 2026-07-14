using EasyCaching.Core;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common;
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
                    async (CreateRivalRequest req, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var command = new CreateRivalCommand
                        {
                            Name = req.Name,
                            UrlPhoto = req.UrlPhoto,
                            Category = req.Category
                        };
                        var result = await mediator.Send(command, cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(CreateRival))
                .WithTags("Rivals")
                .Produces<RivalSaveResponse>()
                .Produces(StatusCodes.Status400BadRequest)
                .RequireAuthorization();
        }
    }

    public record CreateRivalRequest(string Name, string? UrlPhoto, string? Category);

    public record CreateRivalCommand : IRequest<RivalSaveResponse>, IInvalidateCacheRequest, IRequireFeaturePermission
    {
        public string Name { get; set; } = string.Empty;
        public string? UrlPhoto { get; set; }
        public string? Category { get; set; }

        public string PrefixCacheKey => "Rivals";
        public string FeatureRoute => CoachFeatureRoutes.Rivals;
        public string RequiredPermission => "ReadWrite";
    }

    public class CreateRivalHandler : IRequestHandler<CreateRivalCommand, RivalSaveResponse>
    {
        private readonly AppDbContext _db;
        private readonly IEasyCachingProviderFactory _cachingFactory;

        public CreateRivalHandler(AppDbContext db, IEasyCachingProviderFactory cachingFactory)
        {
            _db = db;
            _cachingFactory = cachingFactory;
        }

        public async ValueTask<RivalSaveResponse> Handle(CreateRivalCommand request, CancellationToken cancellationToken)
        {
            var rival = new Rival(request.Name, request.UrlPhoto, request.Category);
            _db.Rivals.Add(rival);
            await _db.SaveChangesAsync(cancellationToken);

            var cache = _cachingFactory.GetCachingProvider(Cache.CacheDefaultName);
            await cache.RemoveAsync("Rivals", cancellationToken);

            return new RivalSaveResponse(rival.Id, rival.Name, rival.UrlPhoto, rival.Category);
        }
    }

    public class CreateRivalValidator : AbstractValidator<CreateRivalCommand>
    {
        public CreateRivalValidator()
        {
            RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        }
    }

    public record RivalSaveResponse(string Id, string Name, string? UrlPhoto, string? Category);
}
