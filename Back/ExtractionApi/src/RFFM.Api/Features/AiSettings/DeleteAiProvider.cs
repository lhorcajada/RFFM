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
    /// Deletes an AI provider of the current user, with its stored key. DELETE /api/ai-providers/{id}
    /// </summary>
    public class DeleteAiProvider : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/api/ai-providers/{id}",
                    async (string id, IMediator mediator, CancellationToken ct) =>
                    {
                        await mediator.Send(new DeleteAiProviderCommand(id), ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteAiProvider))
                .WithTags(AiSettingsConstants.Tag)
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .RequireAuthorization();
        }

        public record DeleteAiProviderCommand(string Id) : IRequest<Unit>;

        public class Handler : IRequestHandler<DeleteAiProviderCommand, Unit>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<Unit> Handle(DeleteAiProviderCommand request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                var provider = await _db.AiProviderSettings
                    .FirstOrDefaultAsync(p => p.Id == request.Id && p.UserId == userId, cancellationToken)
                    ?? throw new NotFoundException("No se encontró el proveedor de IA.", ErrorCodes.AiProviderNotFound);

                _db.AiProviderSettings.Remove(provider);
                await _db.SaveChangesAsync(cancellationToken);

                return Unit.Value;
            }
        }
    }
}
