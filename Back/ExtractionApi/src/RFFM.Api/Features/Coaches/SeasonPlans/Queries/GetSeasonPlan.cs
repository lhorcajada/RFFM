using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.SeasonPlans;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.SeasonPlans.Queries
{
    /// <summary>
    /// Returns the full season plan for a team and season, including a per-Microciclo linked
    /// TrainingSession summary (this single query powers the Planificación coverage view).
    /// GET /api/season-plans?teamId={teamId}&amp;seasonId={seasonId}
    /// </summary>
    public class GetSeasonPlan : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/season-plans",
                    async (string teamId, string seasonId, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;

                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        var result = await mediator.Send(new SeasonPlanQuery(teamId, seasonId, userId), cancellationToken);
                        return result is null ? Results.NoContent() : Results.Ok(result);
                    })
                .WithName(nameof(GetSeasonPlan))
                .WithTags(SeasonPlanConstants.Tag)
                .RequireAuthorization()
                .Produces<SeasonPlanResponse>()
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden);
        }

        public record SeasonPlanQuery(string TeamId, string SeasonId, string UserId) : IRequest<SeasonPlanResponse?>, IRequireFeaturePermission
        {
            public string FeatureRoute => CoachFeatureRoutes.SeasonPlan;
            public string RequiredPermission => "Read";
        }

        // ── Response DTOs ────────────────────────────────────────────────────────

        public record SeasonPlanResponse(
            string Id,
            string TeamId,
            string SeasonId,
            IEnumerable<MacrocicloResponse> Macrociclos);

        public record MacrocicloResponse(
            string Id,
            int Order,
            string Name,
            DateOnly StartDate,
            DateOnly EndDate,
            IEnumerable<MesocicloResponse> Mesociclos);

        public record MesocicloResponse(
            string Id,
            int Order,
            string Name,
            DateOnly StartDate,
            DateOnly EndDate,
            int GameZoneId,
            IEnumerable<MicrocicloResponse> Microciclos);

        public record MicrocicloResponse(
            string Id,
            int Order,
            string WeekLabel,
            DateOnly StartDate,
            DateOnly EndDate,
            IEnumerable<SessionSummary> Sessions);

        /// <summary>Summary of a TrainingSession linked to a Microciclo, per specs/season-plan.md
        /// "GET includes session coverage per Microciclo".</summary>
        public record SessionSummary(string Id, string Name, string? ObjetivoGeneral, DateTime Date, int ExerciseCount);

        // ── Handler ──────────────────────────────────────────────────────────────

        public class Handler : IRequestHandler<SeasonPlanQuery, SeasonPlanResponse?>
        {
            private readonly AppDbContext _db;
            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<SeasonPlanResponse?> Handle(SeasonPlanQuery request, CancellationToken cancellationToken = default)
            {
                var hasAccess = await _db.UserClubs
                    .Join(_db.Teams, uc => uc.ClubId, t => t.ClubId, (uc, t) => new { uc, t })
                    .AnyAsync(x => x.uc.ApplicationUserId == request.UserId && x.t.Id == request.TeamId, cancellationToken);

                if (!hasAccess)
                    throw new DomainException("Planificación de Temporada", "No tienes acceso a este equipo.", ErrorCodes.TeamAccessDenied);

                var plan = await _db.SeasonPlans
                    .Include(sp => sp.Macrociclos)
                        .ThenInclude(m => m.Mesociclos)
                            .ThenInclude(m => m.Microciclos)
                    .AsSplitQuery()
                    .AsNoTracking()
                    .FirstOrDefaultAsync(sp => sp.TeamId == request.TeamId && sp.SeasonId == request.SeasonId, cancellationToken);

                if (plan is null)
                    return null;

                var microcicloIds = plan.Macrociclos
                    .SelectMany(m => m.Mesociclos)
                    .SelectMany(m => m.Microciclos)
                    .Select(m => m.Id)
                    .ToList();

                var sessions = await _db.TrainingSessions
                    .Include(s => s.Blocks)
                        .ThenInclude(b => b.Exercises)
                    .AsSplitQuery()
                    .AsNoTracking()
                    .Where(s => s.MicrocicloId != null && microcicloIds.Contains(s.MicrocicloId!))
                    .ToListAsync(cancellationToken);

                IEnumerable<SessionSummary> ResolveSessions(string microcicloId) =>
                    sessions
                        .Where(s => s.MicrocicloId == microcicloId)
                        .Select(s => new SessionSummary(
                            s.Id, s.Name, s.ObjetivoGeneral, s.Date,
                            s.Blocks.SelectMany(b => b.Exercises).Select(e => e.TaskTrainingBaseId).Distinct().Count()));

                MicrocicloResponse MapMicrociclo(Microciclo m) => new(
                    m.Id, m.Order, m.WeekLabel, m.StartDate, m.EndDate, ResolveSessions(m.Id));

                MesocicloResponse MapMesociclo(Mesociclo m) => new(
                    m.Id, m.Order, m.Name, m.StartDate, m.EndDate, m.GameZoneId,
                    m.Microciclos.OrderBy(x => x.Order).Select(MapMicrociclo));

                MacrocicloResponse MapMacrociclo(Macrociclo m) => new(
                    m.Id, m.Order, m.Name, m.StartDate, m.EndDate,
                    m.Mesociclos.OrderBy(x => x.Order).Select(MapMesociclo));

                return new SeasonPlanResponse(
                    plan.Id,
                    plan.TeamId,
                    plan.SeasonId,
                    plan.Macrociclos.OrderBy(m => m.Order).Select(MapMacrociclo));
            }
        }
    }
}
