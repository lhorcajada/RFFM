using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
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
    /// Toggles the mastery state of an essential skill (sets or clears MasteredAt).
    /// PATCH /api/game-models/essential-skills/{skillId}/mastered
    /// </summary>
    public class ToggleSkillMastered : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPatch("/api/game-models/essential-skills/{skillId}/mastered",
                    async (string skillId, HttpContext httpContext, IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        var result = await mediator.Send(new ToggleSkillMasteredCommand(skillId, userId), ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(ToggleSkillMastered))
                .WithTags(GameModelConstants.Tag)
                .RequireAuthorization()
                .Produces<ToggleSkillMasteredResult>()
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces(StatusCodes.Status404NotFound);
        }
    }

    public record ToggleSkillMasteredCommand(string SkillId, string UserId) : IRequest<ToggleSkillMasteredResult>, IRequireFeaturePermission
    {
        public string FeatureRoute => CoachFeatureRoutes.GameModel;
        public string RequiredPermission => "ReadWrite";
    }

    public record ToggleSkillMasteredResult(DateTime? MasteredAt);

    public class ToggleSkillMasteredHandler : IRequestHandler<ToggleSkillMasteredCommand, ToggleSkillMasteredResult>
    {
        private readonly AppDbContext _db;
        public ToggleSkillMasteredHandler(AppDbContext db) => _db = db;

        public async ValueTask<ToggleSkillMasteredResult> Handle(ToggleSkillMasteredCommand request, CancellationToken ct = default)
        {
            var skill = await _db.EssentialSkills
                .FirstOrDefaultAsync(es => es.Id == request.SkillId, ct);

            if (skill is null)
                throw new DomainException("Habilidades", $"Habilidad no encontrada: {request.SkillId}", ErrorCodes.SkillNotFound);

            // Verify access: EssentialSkill → SubSubPrinciple → SubPrinciple → GameScenario → GameModel → Team → Club → UserClub
            var hasAccess = await _db.EssentialSkills
                .Where(es => es.Id == request.SkillId)
                .Join(_db.SubSubPrinciples, es => es.SubSubPrincipleId, ssp => ssp.Id, (es, ssp) => ssp)
                .Join(_db.SubPrinciples, ssp => ssp.SubPrincipleId, sp => sp.Id, (ssp, sp) => sp)
                .Join(_db.GameScenarios, sp => sp.GameScenarioId, gs => gs.Id, (sp, gs) => gs)
                .Join(_db.GameModels, gs => gs.GameModelId, gm => gm.Id, (gs, gm) => gm)
                .Join(_db.Teams, gm => gm.TeamId, t => t.Id, (gm, t) => t)
                .Join(_db.UserClubs, t => t.ClubId, uc => uc.ClubId, (t, uc) => uc)
                .AnyAsync(uc => uc.ApplicationUserId == request.UserId, ct);

            if (!hasAccess)
                throw new DomainException("Habilidades", "No tienes acceso a esta habilidad.", ErrorCodes.SkillAccessDenied);

            skill.MasteredAt = skill.MasteredAt.HasValue ? null : DateTime.UtcNow;

            await _db.SaveChangesAsync(ct);
            return new ToggleSkillMasteredResult(skill.MasteredAt);
        }
    }
}
