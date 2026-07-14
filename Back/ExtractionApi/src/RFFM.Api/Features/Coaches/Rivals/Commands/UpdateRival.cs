using EasyCaching.Core;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Rivals.Commands
{
    public class UpdateRival : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/rivals/{id}",
                    async (string id, UpdateRivalRequest req, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var command = new UpdateRivalCommand
                        {
                            Id = id,
                            Name = req.Name,
                            UrlPhoto = req.UrlPhoto,
                            Category = req.Category
                        };
                        var result = await mediator.Send(command, cancellationToken);
                        return result ? Results.Ok() : Results.NotFound();
                    })
                .WithName(nameof(UpdateRival))
                .WithTags("Rivals")
                .Produces(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status404NotFound)
                .RequireAuthorization();
        }
    }

    public record UpdateRivalRequest(string Name, string? UrlPhoto, string? Category);

    public record UpdateRivalCommand : IRequest<bool>, IInvalidateCacheRequest, IRequireFeaturePermission
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? UrlPhoto { get; set; }
        public string? Category { get; set; }

        public string PrefixCacheKey => "Rivals";
        public string FeatureRoute => CoachFeatureRoutes.Rivals;
        public string RequiredPermission => "ReadWrite";
    }

    public class UpdateRivalHandler : IRequestHandler<UpdateRivalCommand, bool>
    {
        private readonly AppDbContext _db;
        private readonly IEasyCachingProviderFactory _cachingFactory;

        public UpdateRivalHandler(AppDbContext db, IEasyCachingProviderFactory cachingFactory)
        {
            _db = db;
            _cachingFactory = cachingFactory;
        }

        public async ValueTask<bool> Handle(UpdateRivalCommand request, CancellationToken cancellationToken)
        {
            var rival = await _db.Rivals.FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);
            if (rival is null) return false;

            rival.SetName(request.Name);
            rival.SetUrlPhoto(request.UrlPhoto);
            rival.SetCategory(request.Category);
            await _db.SaveChangesAsync(cancellationToken);

            var cache = _cachingFactory.GetCachingProvider(Cache.CacheDefaultName);
            await cache.RemoveAsync("Rivals", cancellationToken);

            return true;
        }
    }

    public class UpdateRivalValidator : AbstractValidator<UpdateRivalCommand>
    {
        public UpdateRivalValidator()
        {
            RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
            RuleFor(x => x.Category).MaximumLength(50).When(x => x.Category != null);
        }
    }
}
