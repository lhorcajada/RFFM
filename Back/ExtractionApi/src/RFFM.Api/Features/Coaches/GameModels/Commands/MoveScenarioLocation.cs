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
    /// Moves a scenario to a different principle within the same game model, keeping its full
    /// nested content (sub-principles, sub-sub-principles, essential skills, media) intact and
    /// renumbering the scenarios that remain in the source principle.
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
                            new MoveScenarioLocationCommand(scenarioId, request.TargetGamePrincipleId, userId), ct);
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

    public record MoveScenarioLocationRequest(string TargetGamePrincipleId);

    public record MoveScenarioLocationCommand(
        string ScenarioId, string TargetGamePrincipleId, string UserId) : IRequest<MoveScenarioLocationResult>, IRequireFeaturePermission
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

            var sourcePrinciple = await _db.GamePrinciples
                .FirstOrDefaultAsync(p => p.Id == scenario.GamePrincipleId, ct);
            if (sourcePrinciple is null)
                throw new DomainException("Modelo de Juego", "Principio no encontrado.", ErrorCodes.GameModelNotFound);

            var targetPrinciple = await _db.GamePrinciples
                .FirstOrDefaultAsync(p => p.Id == request.TargetGamePrincipleId, ct);
            if (targetPrinciple is null)
                throw new DomainException("Modelo de Juego", "Principio de destino no encontrado.", ErrorCodes.GameModelNotFound);

            // Access check: GameScenario → GamePrinciple → GameModel → Team → Club → UserClub (same shape as ToggleSkillMastered/UpdateGameModel).
            var hasAccess = await _db.GameScenarios
                .Where(s => s.Id == request.ScenarioId)
                .Join(_db.GamePrinciples, s => s.GamePrincipleId, gp => gp.Id, (s, gp) => gp)
                .Join(_db.GameModels, gp => gp.GameModelId, gm => gm.Id, (gp, gm) => gm)
                .Join(_db.Teams, gm => gm.TeamId, t => t.Id, (gm, t) => t)
                .Join(_db.UserClubs, t => t.ClubId, uc => uc.ClubId, (t, uc) => uc)
                .AnyAsync(uc => uc.ApplicationUserId == request.UserId, ct);
            if (!hasAccess)
                throw new DomainException("Modelo de Juego", "No tienes acceso a este modelo de juego.", ErrorCodes.GameModelAccessDenied);

            if (targetPrinciple.GameModelId != sourcePrinciple.GameModelId)
                throw new DomainException("Modelo de Juego", "El principio de destino pertenece a otro modelo de juego.", ErrorCodes.GameModelNotFound);

            var sameLocation = scenario.GamePrincipleId == targetPrinciple.Id;
            if (sameLocation)
                return new MoveScenarioLocationResult(scenario.Order);

            var sourcePrincipleId = scenario.GamePrincipleId;

            var siblingsInModel = await _db.GameScenarios
                .Where(s => s.Id != scenario.Id && (s.GamePrincipleId == sourcePrincipleId || s.GamePrincipleId == targetPrinciple.Id))
                .ToListAsync(ct);

            var newOrder = siblingsInModel.Count(s => s.GamePrincipleId == targetPrinciple.Id) + 1;

            scenario.ReparentTo(targetPrinciple.Id);
            scenario.UpdateOrder(newOrder);

            // Renumber the scenarios left behind in the source principle (mirrors DEL_SCENARIO reducer on the frontend).
            var remainingInSource = siblingsInModel
                .Where(s => s.GamePrincipleId == sourcePrincipleId)
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
            RuleFor(x => x.TargetGamePrincipleId).NotEmpty();
        }
    }
}
