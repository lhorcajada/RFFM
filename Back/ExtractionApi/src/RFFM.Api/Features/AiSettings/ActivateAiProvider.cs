using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.AiSettings
{
    /// <summary>
    /// Marks one AI provider of the current user as the active one. POST /api/ai-providers/{id}/activate
    /// </summary>
    public class ActivateAiProvider : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/ai-providers/{id}/activate",
                    async (string id, IMediator mediator, CancellationToken ct) =>
                    {
                        await mediator.Send(new ActivateAiProviderCommand(id), ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(ActivateAiProvider))
                .WithTags(AiSettingsConstants.Tag)
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .RequireAuthorization();
        }

        public record ActivateAiProviderCommand(string Id) : IRequest<Unit>;

        public class Handler : IRequestHandler<ActivateAiProviderCommand, Unit>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<Unit> Handle(ActivateAiProviderCommand request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                var providers = await _db.AiProviderSettings
                    .Where(p => p.UserId == userId)
                    .ToListAsync(cancellationToken);

                if (providers.All(p => p.Id != request.Id))
                    throw new NotFoundException("No se encontró el proveedor de IA.", ErrorCodes.AiProviderNotFound);

                foreach (var provider in providers)
                    provider.SetActive(provider.Id == request.Id);

                await _db.SaveChangesAsync(cancellationToken);

                return Unit.Value;
            }
        }
    }
}
