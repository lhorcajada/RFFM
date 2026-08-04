using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.GameModels.Commands
{
    /// <summary>
    /// Replaces all principles and scenarios of an existing game model.
    /// PUT /api/game-models/{id}
    /// </summary>
    public class UpdateGameModel : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/game-models/{id}",
                    async (string id, UpdateGameModelCommand command, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;

                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        await mediator.Send(command with { Id = id, UserId = userId }, cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(UpdateGameModel))
                .WithTags(GameModelConstants.Tag)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden);
        }
    }

    // ── Request ──────────────────────────────────────────────────────────────────

    public record UpdateGameModelCommand(
        string Name,
        List<PrincipleRequest> Principles) : IRequest, IRequireFeaturePermission
    {
        public string Id { get; init; } = string.Empty;
        public string UserId { get; init; } = string.Empty;

        public string FeatureRoute => CoachFeatureRoutes.GameModel;
        public string RequiredPermission => "ReadWrite";
    }

    // ── Handler ──────────────────────────────────────────────────────────────────

    public class UpdateGameModelHandler : IRequestHandler<UpdateGameModelCommand, Unit>
    {
        private readonly AppDbContext _db;
        public UpdateGameModelHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(UpdateGameModelCommand request, CancellationToken cancellationToken = default)
        {
            var model = await _db.GameModels
                .Include(gm => gm.Principles)
                    .ThenInclude(p => p.Scenarios)
                        .ThenInclude(s => s.SubPrinciples)
                            .ThenInclude(sp => sp.SubSubPrinciples)
                                .ThenInclude(ssp => ssp.EssentialSkills)
                .FirstOrDefaultAsync(gm => gm.Id == request.Id, cancellationToken);

            if (model is null)
                throw new DomainException("Modelo de Juego", "Modelo de juego no encontrado.", ErrorCodes.GameModelNotFound);

            var hasAccess = await _db.UserClubs
                .Join(_db.Teams, uc => uc.ClubId, t => t.ClubId, (uc, t) => new { uc, t })
                .AnyAsync(x => x.uc.ApplicationUserId == request.UserId && x.t.Id == model.TeamId, cancellationToken);

            if (!hasAccess)
                throw new DomainException("Modelo de Juego", "No tienes acceso a este modelo de juego.", ErrorCodes.GameModelAccessDenied);

            model.UpdateName(request.Name);

            // ── Upsert principles ───────────────────────────────────────────────
            var matchedPrincipleIds = new HashSet<string>();

            foreach (var pr in request.Principles)
            {
                var existing = string.IsNullOrEmpty(pr.Id)
                    ? model.Principles.FirstOrDefault(p =>
                        p.GameMomentId == pr.GameMomentId &&
                        p.GameZoneId == pr.GameZoneId &&
                        p.Order == pr.Order)
                    : model.Principles.FirstOrDefault(p => p.Id == pr.Id);

                if (existing is not null)
                {
                    matchedPrincipleIds.Add(existing.Id);
                    existing.UpdateTitle(pr.Title);
                    existing.UpdateDescription(pr.Description);
                    existing.UpdateOrder(pr.Order);

                    UpsertScenarios(existing, pr.Scenarios);
                }
                else
                {
                    var newPrinciple = new GamePrinciple(model.Id, pr.GameMomentId, pr.GameZoneId, pr.Order, pr.Title, pr.Description);
                    BuildScenarios(newPrinciple, pr.Scenarios);
                    model.Principles.Add(newPrinciple);
                    matchedPrincipleIds.Add(newPrinciple.Id);
                }
            }

            // Remove principles no longer in request (cascades to their scenarios)
            var principlesToRemove = model.Principles
                .Where(p => !matchedPrincipleIds.Contains(p.Id))
                .ToList();
            _db.GamePrinciples.RemoveRange(principlesToRemove);

            await _db.SaveChangesAsync(cancellationToken);
            return Unit.Value;
        }

        // ── Upsert scenarios inside an existing principle ──────────────────────

        private void UpsertScenarios(GamePrinciple principle, List<ScenarioRequest> requests)
        {
            var matchedScenarioIds = new HashSet<string>();

            foreach (var sr in requests)
            {
                var existing = string.IsNullOrEmpty(sr.Id)
                    ? principle.Scenarios.FirstOrDefault(s => s.Order == sr.Order)
                    : principle.Scenarios.FirstOrDefault(s => s.Id == sr.Id);

                if (existing is not null)
                {
                    matchedScenarioIds.Add(existing.Id);
                    existing.UpdateName(sr.Name);
                    existing.UpdateContext(sr.Context);
                    existing.UpdateOrder(sr.Order);

                    UpsertSubPrinciples(existing, sr.SubPrinciples);
                }
                else
                {
                    var newScenario = new GameScenario(principle.Id, sr.Order, sr.Name, sr.Context);
                    BuildSubPrinciples(newScenario, sr.SubPrinciples);
                    principle.Scenarios.Add(newScenario);
                    matchedScenarioIds.Add(newScenario.Id);
                }
            }

            var toRemove = principle.Scenarios
                .Where(s => !matchedScenarioIds.Contains(s.Id))
                .ToList();
            _db.GameScenarios.RemoveRange(toRemove);
        }

        // ── Upsert sub-principles inside an existing scenario ─────────────────

        private void UpsertSubPrinciples(GameScenario scenario, List<SubPrincipleRequest> requests)
        {
            var matchedSpIds = new HashSet<string>();

            foreach (var spr in requests)
            {
                var existing = string.IsNullOrEmpty(spr.Id)
                    ? scenario.SubPrinciples.FirstOrDefault(sp => sp.Order == spr.Order)
                    : scenario.SubPrinciples.FirstOrDefault(sp => sp.Id == spr.Id);

                if (existing is not null)
                {
                    matchedSpIds.Add(existing.Id);
                    existing.UpdateLabel(spr.Label);
                    existing.UpdateName(spr.Name);
                    existing.UpdateContext(spr.Context);
                    existing.UpdateOrder(spr.Order);

                    UpsertSubSubPrinciples(existing, spr.SubSubPrinciples);
                }
                else
                {
                    var newSp = new SubPrinciple(scenario.Id, spr.Label, spr.Name, spr.Context, spr.Order);
                    BuildSubSubPrinciples(newSp, spr.SubSubPrinciples);
                    scenario.SubPrinciples.Add(newSp);
                    matchedSpIds.Add(newSp.Id);
                }
            }

            var spToRemove = scenario.SubPrinciples
                .Where(sp => !matchedSpIds.Contains(sp.Id))
                .ToList();
            _db.SubPrinciples.RemoveRange(spToRemove);
        }

        // ── Upsert sub-sub-principles inside an existing sub-principle ─────────
        // KEY: preserves IDs of existing SSPs so TaskTrainingBase.SubSubPrincipleId stays valid

        private void UpsertSubSubPrinciples(SubPrinciple sp, List<SubSubPrincipleRequest> requests)
        {
            var matchedSspIds = new HashSet<string>();

            foreach (var sspr in requests)
            {
                SubSubPrinciple? existing = null;
                if (!string.IsNullOrEmpty(sspr.Id))
                    existing = sp.SubSubPrinciples.FirstOrDefault(ssp => ssp.Id == sspr.Id);
                if (existing is null && string.IsNullOrEmpty(sspr.Id))
                    existing = sp.SubSubPrinciples.FirstOrDefault(ssp => ssp.Order == sspr.Order);

                if (existing is not null)
                {
                    matchedSspIds.Add(existing.Id);
                    existing.UpdateName(sspr.Name);
                    existing.UpdateAction(sspr.Action);
                    existing.UpdateOrder(sspr.Order);
                    // Re-parent if moved to a different sub-principle (unlikely but safe)
                    if (existing.SubPrincipleId != sp.Id)
                        existing.ReparentTo(sp.Id);

                    UpsertEssentialSkills(existing, sspr.EssentialSkills);
                }
                else
                {
                    var newSsp = new SubSubPrinciple(sp.Id, sspr.Name, sspr.Action, sspr.Order);
                    BuildEssentialSkills(newSsp, sspr.EssentialSkills);
                    sp.SubSubPrinciples.Add(newSsp);
                    matchedSspIds.Add(newSsp.Id);
                }
            }

            var sspToRemove = sp.SubSubPrinciples
                .Where(ssp => !matchedSspIds.Contains(ssp.Id))
                .ToList();
            _db.SubSubPrinciples.RemoveRange(sspToRemove);
        }

        // ── Upsert essential skills inside an existing SSP ────────────────────
        // KEY: preserves IDs of existing skills so TaskTrainingSkill.EssentialSkillId stays valid

        private void UpsertEssentialSkills(SubSubPrinciple ssp, List<EssentialSkillRequest> requests)
        {
            var matchedSkillIds = new HashSet<string>();

            foreach (var skr in requests)
            {
                EssentialSkill? existing = null;
                if (!string.IsNullOrEmpty(skr.Id))
                    existing = ssp.EssentialSkills.FirstOrDefault(sk => sk.Id == skr.Id);

                if (existing is not null)
                {
                    matchedSkillIds.Add(existing.Id);
                    existing.UpdateName(skr.Name);
                    existing.UpdateDescription(skr.Description);
                }
                else
                {
                    var newSkill = new EssentialSkill(ssp.Id, skr.Name, skr.Description);
                    ssp.EssentialSkills.Add(newSkill);
                    matchedSkillIds.Add(newSkill.Id);
                }
            }

            var toRemove = ssp.EssentialSkills
                .Where(sk => !matchedSkillIds.Contains(sk.Id))
                .ToList();
            _db.EssentialSkills.RemoveRange(toRemove);
        }

        // ── Build helpers for new entities (no existing IDs) ─────────────────

        private static void BuildScenarios(GamePrinciple principle, List<ScenarioRequest> requests)
        {
            foreach (var sr in requests)
            {
                var scenario = new GameScenario(principle.Id, sr.Order, sr.Name, sr.Context);
                BuildSubPrinciples(scenario, sr.SubPrinciples);
                principle.Scenarios.Add(scenario);
            }
        }

        private static void BuildSubPrinciples(GameScenario scenario, List<SubPrincipleRequest> requests)
        {
            foreach (var spr in requests)
            {
                var sp = new SubPrinciple(scenario.Id, spr.Label, spr.Name, spr.Context, spr.Order);
                BuildSubSubPrinciples(sp, spr.SubSubPrinciples);
                scenario.SubPrinciples.Add(sp);
            }
        }

        private static void BuildSubSubPrinciples(SubPrinciple sp, List<SubSubPrincipleRequest> requests)
        {
            foreach (var sspr in requests)
            {
                var ssp = new SubSubPrinciple(sp.Id, sspr.Name, sspr.Action, sspr.Order);
                BuildEssentialSkills(ssp, sspr.EssentialSkills);
                sp.SubSubPrinciples.Add(ssp);
            }
        }

        private static void BuildEssentialSkills(SubSubPrinciple ssp, List<EssentialSkillRequest> requests)
        {
            foreach (var skr in requests)
                ssp.EssentialSkills.Add(new EssentialSkill(ssp.Id, skr.Name, skr.Description));
        }
    }

    // ── Validator ────────────────────────────────────────────────────────────────

    public class UpdateGameModelValidator : AbstractValidator<UpdateGameModelCommand>
    {
        public UpdateGameModelValidator()
        {
            RuleFor(x => x.Id).NotEmpty();
            RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        }
    }
}
