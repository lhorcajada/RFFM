using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.AiSettings
{
    /// <summary>
    /// Lists the AI providers of the current user. GET /api/ai-providers
    /// </summary>
    public class GetAiProviders : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/ai-providers",
                    async (IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new GetAiProvidersQuery(), ct)))
                .WithName(nameof(GetAiProviders))
                .WithTags(AiSettingsConstants.Tag)
                .Produces<List<AiProviderDto>>(StatusCodes.Status200OK)
                .RequireAuthorization();
        }

        public record GetAiProvidersQuery : IRequest<List<AiProviderDto>>;

        public class Handler : IRequestHandler<GetAiProvidersQuery, List<AiProviderDto>>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<List<AiProviderDto>> Handle(GetAiProvidersQuery request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                var providers = await _db.AiProviderSettings
                    .AsNoTracking()
                    .Where(p => p.UserId == userId)
                    .OrderBy(p => p.CreatedAt)
                    .ToListAsync(cancellationToken);

                return providers.Select(AiProviderDto.From).ToList();
            }
        }
    }
}
