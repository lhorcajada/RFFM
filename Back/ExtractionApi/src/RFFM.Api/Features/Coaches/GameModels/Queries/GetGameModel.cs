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

namespace RFFM.Api.Features.Coaches.GameModels.Queries
{
    /// <summary>
    /// Returns the full game model for a team and season.
    /// GET /api/game-models?teamId={teamId}&amp;season={season}
    /// </summary>
    public class GetGameModel : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/game-models",
                    async (string teamId, string season, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;

                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        var result = await mediator.Send(new GameModelQuery(teamId, season, userId), cancellationToken);
                        return result is null ? Results.NotFound() : Results.Ok(result);
                    })
                .WithName(nameof(GetGameModel))
                .WithTags(GameModelConstants.Tag)
                .RequireAuthorization()
                .Produces<GameModelResponse>()
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden);
        }

        public record GameModelQuery(string TeamId, string Season, string UserId) : IRequest<GameModelResponse?>, IRequireFeaturePermission
        {
            public string FeatureRoute => CoachFeatureRoutes.GameModel;
            public string RequiredPermission => "Read";
        }

        // ── Response DTOs ────────────────────────────────────────────────────────

        public record GameModelResponse(
            string Id,
            string TeamId,
            string Name,
            string Season,
            IEnumerable<PrincipleResponse> Principles);

        public record PrincipleResponse(
            string Id,
            int GameMomentId,
            string GameMomentName,
            int GameZoneId,
            string GameZoneName,
            int Order,
            string Title,
            string Description,
            IEnumerable<ScenarioResponse> Scenarios);

        public record ScenarioResponse(
            string Id,
            int Order,
            string Name,
            string Context,
            IEnumerable<SubPrincipleResponse> SubPrinciples,
            string? MediaUrl,
            string? MediaType);

        public record SubPrincipleResponse(
            string Id,
            string Label,
            int Order,
            string Name,
            string Context,
            IEnumerable<SubSubPrincipleResponse> SubSubPrinciples);

        public record SubSubPrincipleResponse(
            string Id,
            int Order,
            string Name,
            string Action,
            IEnumerable<EssentialSkillResponse> EssentialSkills);

        public record EssentialSkillResponse(
            string Id,
            string Name,
            string Description,
            DateTime? MasteredAt,
            int ExerciseCount);

        // ── Handler ──────────────────────────────────────────────────────────────

        public class Handler : IRequestHandler<GameModelQuery, GameModelResponse?>
        {
            private readonly AppDbContext _db;
            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<GameModelResponse?> Handle(GameModelQuery request, CancellationToken cancellationToken = default)
            {
                var hasAccess = await _db.UserClubs
                    .Join(_db.Teams, uc => uc.ClubId, t => t.ClubId, (uc, t) => new { uc, t })
                    .AnyAsync(x => x.uc.ApplicationUserId == request.UserId && x.t.Id == request.TeamId, cancellationToken);

                if (!hasAccess)
                    throw new DomainException("Modelo de Juego", "No tienes acceso a este equipo.", ErrorCodes.TeamAccessDenied);

                var model = await _db.GameModels
                    .Include(gm => gm.Principles)
                        .ThenInclude(p => p.GameMoment)
                    .Include(gm => gm.Principles)
                        .ThenInclude(p => p.GameZone)
                    .Include(gm => gm.Principles)
                        .ThenInclude(p => p.Scenarios)
                            .ThenInclude(s => s.SubPrinciples)
                                .ThenInclude(sp => sp.SubSubPrinciples)
                                    .ThenInclude(ssp => ssp.EssentialSkills)
                    .AsNoTracking()
                    .FirstOrDefaultAsync(gm => gm.TeamId == request.TeamId && gm.Season == request.Season, cancellationToken);

                if (model is null)
                    return null;

                // Load exercise counts per essential skill
                var skillIds = model.Principles
                    .SelectMany(p => p.Scenarios)
                    .SelectMany(s => s.SubPrinciples)
                    .SelectMany(sp => sp.SubSubPrinciples)
                    .SelectMany(ssp => ssp.EssentialSkills)
                    .Select(sk => sk.Id)
                    .ToList();

                var exerciseCounts = skillIds.Count > 0
                    ? await _db.TaskTrainingSkills
                        .Where(ts => skillIds.Contains(ts.EssentialSkillId))
                        .GroupBy(ts => ts.EssentialSkillId)
                        .Select(g => new { SkillId = g.Key, Count = g.Count() })
                        .ToDictionaryAsync(x => x.SkillId, x => x.Count, cancellationToken)
                    : new Dictionary<string, int>();

                return new GameModelResponse(
                    model.Id,
                    model.TeamId,
                    model.Name,
                    model.Season,
                    model.Principles
                        .OrderBy(p => p.GameMomentId)
                        .ThenBy(p => p.GameZoneId)
                        .ThenBy(p => p.Order)
                        .Select(p => new PrincipleResponse(
                            p.Id,
                            p.GameMomentId,
                            p.GameMoment.Name,
                            p.GameZoneId,
                            p.GameZone.Name,
                            p.Order,
                            p.Title,
                            p.Description,
                            p.Scenarios
                                .OrderBy(s => s.Order)
                                .Select(s => new ScenarioResponse(
                                    s.Id,
                                    s.Order,
                                    s.Name,
                                    s.Context,
                                    s.SubPrinciples
                                        .OrderBy(sp => sp.Order)
                                        .ThenBy(sp => sp.Label)
                                        .Select(sp => new SubPrincipleResponse(
                                            sp.Id,
                                            sp.Label,
                                            sp.Order,
                                            sp.Name,
                                            sp.Context,
                                            sp.SubSubPrinciples
                                                .OrderBy(ssp => ssp.Order)
                                                .ThenBy(ssp => ssp.Name)
                                                .Select(ssp => new SubSubPrincipleResponse(
                                                    ssp.Id,
                                                    ssp.Order,
                                                    ssp.Name,
                                                    ssp.Action,
                                                    ssp.EssentialSkills.Select(sk => new EssentialSkillResponse(
                                                        sk.Id,
                                                        sk.Name,
                                                        sk.Description,
                                                        sk.MasteredAt,
                                                        exerciseCounts.GetValueOrDefault(sk.Id, 0)))
                                                ))
                                        )),
                                    s.MediaUrl,
                                    s.MediaType
                                ))
                        ))
                );
            }
        }
    }
}
