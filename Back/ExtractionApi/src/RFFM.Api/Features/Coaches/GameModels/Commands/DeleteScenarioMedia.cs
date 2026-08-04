using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Storage;

namespace RFFM.Api.Features.Coaches.GameModels.Commands
{
    /// <summary>
    /// Deletes the media (image/video) attached to a game scenario, if any. Idempotent.
    /// DELETE /api/game-models/scenarios/{id}/media
    /// </summary>
    public class DeleteScenarioMedia : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/api/game-models/scenarios/{id}/media",
                    async (string id, HttpContext httpContext, IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        await mediator.Send(new DeleteScenarioMediaCommand(id, userId), ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteScenarioMedia))
                .WithTags(GameModelConstants.Tag)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }
    }

    public record DeleteScenarioMediaCommand(string ScenarioId, string UserId) : IRequest, IRequireFeaturePermission
    {
        public string FeatureRoute => CoachFeatureRoutes.GameModel;
        public string RequiredPermission => "ReadWrite";
    }

    public class DeleteScenarioMediaHandler : IRequestHandler<DeleteScenarioMediaCommand, Unit>
    {
        private const string Bucket = "game-scenarios";

        private readonly AppDbContext _db;
        private readonly IStorageService _storage;

        public DeleteScenarioMediaHandler(AppDbContext db, IStorageService storage)
        {
            _db = db;
            _storage = storage;
        }

        public async ValueTask<Unit> Handle(DeleteScenarioMediaCommand request, CancellationToken ct = default)
        {
            var scenario = await _db.GameScenarios
                .Include(s => s.GamePrinciple)
                    .ThenInclude(p => p.GameModel)
                .FirstOrDefaultAsync(s => s.Id == request.ScenarioId, ct);
            if (scenario is null)
                throw new DomainException("Modelo de Juego", "Escenario no encontrado.", ErrorCodes.ScenarioNotFound);

            var hasAccess = await _db.UserClubs
                .Join(_db.Teams, uc => uc.ClubId, t => t.ClubId, (uc, t) => new { uc, t })
                .AnyAsync(x => x.uc.ApplicationUserId == request.UserId && x.t.Id == scenario.GamePrinciple.GameModel.TeamId, ct);
            if (!hasAccess)
                throw new DomainException("Modelo de Juego", "No tienes acceso a este escenario.", ErrorCodes.GameModelAccessDenied);

            if (!string.IsNullOrEmpty(scenario.MediaUrl))
                await _storage.DeleteAsync(Bucket, Path.GetFileName(scenario.MediaUrl), ct);

            scenario.ClearMedia();
            await _db.SaveChangesAsync(ct);

            return Unit.Value;
        }
    }
}
