using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.GameModels.Commands
{
    /// <summary>
    /// Deletes a game model and all its nested data.
    /// DELETE /api/game-models/{id}
    /// </summary>
    public class DeleteGameModel : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/api/game-models/{id}",
                    async (string id, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;

                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        await mediator.Send(new DeleteGameModelCommand(id, userId), cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteGameModel))
                .WithTags(GameModelConstants.Tag)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden);
        }
    }

    // ── Request ──────────────────────────────────────────────────────────────────

    public record DeleteGameModelCommand(string Id, string UserId) : IRequest;

    // ── Handler ──────────────────────────────────────────────────────────────────

    public class DeleteGameModelHandler : IRequestHandler<DeleteGameModelCommand, Unit>
    {
        private readonly AppDbContext _db;
        public DeleteGameModelHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(DeleteGameModelCommand request, CancellationToken cancellationToken = default)
        {
            var model = await _db.GameModels
                .FirstOrDefaultAsync(gm => gm.Id == request.Id, cancellationToken);

            if (model is null)
                throw new DomainException("Modelo de Juego", "Modelo de juego no encontrado.", ErrorCodes.GameModelNotFound);

            var hasAccess = await _db.UserClubs
                .Join(_db.Teams, uc => uc.ClubId, t => t.ClubId, (uc, t) => new { uc, t })
                .AnyAsync(x => x.uc.ApplicationUserId == request.UserId && x.t.Id == model.TeamId, cancellationToken);

            if (!hasAccess)
                throw new DomainException("Modelo de Juego", "No tienes acceso a este modelo de juego.", ErrorCodes.GameModelAccessDenied);

            _db.GameModels.Remove(model);
            await _db.SaveChangesAsync(cancellationToken);

            return Unit.Value;
        }
    }
}
