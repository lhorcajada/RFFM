using FluentValidation;
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

namespace RFFM.Api.Features.Coaches.GameModels.Commands
{
    /// <summary>
    /// Moves a scenario to a different game moment/zone, keeping its full nested content
    /// (tactical principles, sub-principles, sub-sub-principles, essential skills, media) intact
    /// and renumbering the scenarios that remain in the source moment/zone.
    /// PATCH /api/game-models/scenarios/{scenarioId}/location
    /// </summary>
    public class MoveScenarioLocation : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPatch("/api/game-models/scenarios/{scenarioId}/location",
                    async (string scenarioId, MoveScenarioLocationRequest request, HttpContext httpContext,
                           IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        var result = await mediator.Send(
                            new MoveScenarioLocationCommand(scenarioId, request.GameMomentId, request.GameZoneId, userId), ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(MoveScenarioLocation))
                .WithTags(GameModelConstants.Tag)
                .RequireAuthorization()
                .Produces<MoveScenarioLocationResult>()
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden);
        }
    }

    public record MoveScenarioLocationRequest(int GameMomentId, int GameZoneId);

    public record MoveScenarioLocationCommand(
        string ScenarioId, int GameMomentId, int GameZoneId, string UserId) : IRequest<MoveScenarioLocationResult>, IRequireFeaturePermission
    {
        public string FeatureRoute => CoachFeatureRoutes.GameModel;
        public string RequiredPermission => "ReadWrite";
    }

    public record MoveScenarioLocationResult(int Order);

    public class MoveScenarioLocationHandler : IRequestHandler<MoveScenarioLocationCommand, MoveScenarioLocationResult>
    {
        private readonly AppDbContext _db;
        public MoveScenarioLocationHandler(AppDbContext db) => _db = db;

        public async ValueTask<MoveScenarioLocationResult> Handle(MoveScenarioLocationCommand request, CancellationToken ct = default)
        {
            var scenario = await _db.GameScenarios
                .FirstOrDefaultAsync(s => s.Id == request.ScenarioId, ct);
            if (scenario is null)
                throw new DomainException("Modelo de Juego", "Escenario no encontrado.", ErrorCodes.GameModelNotFound);

            // Access check: GameScenario → GameModel → Team → Club → UserClub (same shape as ToggleSkillMastered/UpdateGameModel).
            var hasAccess = await _db.GameScenarios
                .Where(s => s.Id == request.ScenarioId)
                .Join(_db.GameModels, s => s.GameModelId, gm => gm.Id, (s, gm) => gm)
                .Join(_db.Teams, gm => gm.TeamId, t => t.Id, (gm, t) => t)
                .Join(_db.UserClubs, t => t.ClubId, uc => uc.ClubId, (t, uc) => uc)
                .AnyAsync(uc => uc.ApplicationUserId == request.UserId, ct);
            if (!hasAccess)
                throw new DomainException("Modelo de Juego", "No tienes acceso a este modelo de juego.", ErrorCodes.GameModelAccessDenied);

            var siblingsInModel = await _db.GameScenarios
                .Where(s => s.GameModelId == scenario.GameModelId && s.Id != scenario.Id)
                .ToListAsync(ct);

            var sameLocation = scenario.GameMomentId == request.GameMomentId && scenario.GameZoneId == request.GameZoneId;
            if (sameLocation)
                return new MoveScenarioLocationResult(scenario.Order);

            var (oldMomentId, oldZoneId) = (scenario.GameMomentId, scenario.GameZoneId);

            var newOrder = siblingsInModel
                .Count(s => s.GameMomentId == request.GameMomentId && s.GameZoneId == request.GameZoneId) + 1;

            scenario.UpdateMomentAndZone(request.GameMomentId, request.GameZoneId);
            scenario.UpdateOrder(newOrder);

            // Renumber the scenarios left behind in the source moment/zone (mirrors DEL_SCENARIO reducer on the frontend).
            var remainingInSource = siblingsInModel
                .Where(s => s.GameMomentId == oldMomentId && s.GameZoneId == oldZoneId)
                .OrderBy(s => s.Order)
                .ToList();
            for (var i = 0; i < remainingInSource.Count; i++)
                remainingInSource[i].UpdateOrder(i + 1);

            await _db.SaveChangesAsync(ct);
            return new MoveScenarioLocationResult(scenario.Order);
        }
    }

    public class MoveScenarioLocationValidator : AbstractValidator<MoveScenarioLocationCommand>
    {
        public MoveScenarioLocationValidator()
        {
            RuleFor(x => x.ScenarioId).NotEmpty();
            RuleFor(x => x.GameMomentId).GreaterThan(0);
            RuleFor(x => x.GameZoneId).GreaterThan(0);
        }
    }
}
