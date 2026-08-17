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
    /// Returns the full season plan for a team and season, including a per-Microciclo
    /// linked-exercise count (this single query powers the Planificación coverage view).
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
                        return result is null ? Results.NotFound() : Results.Ok(result);
                    })
                .WithName(nameof(GetSeasonPlan))
                .WithTags(SeasonPlanConstants.Tag)
                .RequireAuthorization()
                .Produces<SeasonPlanResponse>()
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces(StatusCodes.Status404NotFound)
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
            string ObjetivoSesionA,
            string ObjetivoSesionB,
            int ExerciseCount,
            IEnumerable<SubprincipioSummary> SesionASubprincipios,
            IEnumerable<SubSubPrincipioSummary> SesionASubSubPrincipios,
            IEnumerable<string> SesionAHabilidades,
            IEnumerable<SubprincipioSummary> SesionBSubprincipios,
            IEnumerable<SubSubPrincipioSummary> SesionBSubSubPrincipios,
            IEnumerable<string> SesionBHabilidades);

        /// <summary>Denormalized display fields for a Subprincipio linked to a Microciclo session.</summary>
        public record SubprincipioSummary(string Id, string Numero, string Titulo, string GameMomentName);

        /// <summary>Denormalized display fields for a SubSubPrincipio linked to a Microciclo session.</summary>
        public record SubSubPrincipioSummary(string Id, string Numero, string Rol);

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

                var exerciseCounts = await _db.TaskTrainingBases
                    .Where(t => t.MicrocicloId != null)
                    .GroupBy(t => t.MicrocicloId!)
                    .Select(g => new { MicrocicloId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.MicrocicloId, x => x.Count, cancellationToken);

                var microcicloIds = plan.Macrociclos
                    .SelectMany(m => m.Mesociclos)
                    .SelectMany(m => m.Microciclos)
                    .Select(m => m.Id)
                    .ToList();

                var subprincipioLinks = await _db.Set<MicrocicloSubprincipioLink>()
                    .AsNoTracking()
                    .Where(l => microcicloIds.Contains(l.MicrocicloId))
                    .ToListAsync(cancellationToken);

                var subSubPrincipioLinks = await _db.Set<MicrocicloSubSubPrincipioLink>()
                    .AsNoTracking()
                    .Where(l => microcicloIds.Contains(l.MicrocicloId))
                    .ToListAsync(cancellationToken);

                var subprincipioIds = subprincipioLinks.Select(l => l.SubprincipioId).Distinct().ToList();
                var subSubPrincipioIds = subSubPrincipioLinks.Select(l => l.SubSubPrincipioId).Distinct().ToList();

                var subprincipioSummaries = await _db.Subprincipios
                    .AsNoTracking()
                    .Where(s => subprincipioIds.Contains(s.Id))
                    .Select(s => new SubprincipioSummary(s.Id, s.Numero, s.Titulo, s.GamePrinciple.GameMoment.Name))
                    .ToDictionaryAsync(s => s.Id, cancellationToken);

                var subSubPrincipioSummaries = await _db.SubSubPrincipios
                    .AsNoTracking()
                    .Where(s => subSubPrincipioIds.Contains(s.Id))
                    .Select(s => new SubSubPrincipioSummary(s.Id, s.Numero, s.Rol))
                    .ToDictionaryAsync(s => s.Id, cancellationToken);

                IEnumerable<SubprincipioSummary> ResolveSubprincipios(string microcicloId, string session) =>
                    subprincipioLinks
                        .Where(l => l.MicrocicloId == microcicloId && l.Session == session)
                        .Select(l => subprincipioSummaries.GetValueOrDefault(l.SubprincipioId))
                        .Where(s => s is not null)!;

                IEnumerable<SubSubPrincipioSummary> ResolveSubSubPrincipios(string microcicloId, string session) =>
                    subSubPrincipioLinks
                        .Where(l => l.MicrocicloId == microcicloId && l.Session == session)
                        .Select(l => subSubPrincipioSummaries.GetValueOrDefault(l.SubSubPrincipioId))
                        .Where(s => s is not null)!;

                MicrocicloResponse MapMicrociclo(Microciclo m) => new(
                    m.Id, m.Order, m.WeekLabel, m.StartDate, m.EndDate, m.ObjetivoSesionA, m.ObjetivoSesionB,
                    exerciseCounts.GetValueOrDefault(m.Id, 0),
                    ResolveSubprincipios(m.Id, Microciclo.SessionA),
                    ResolveSubSubPrincipios(m.Id, Microciclo.SessionA),
                    m.SesionAHabilidades,
                    ResolveSubprincipios(m.Id, Microciclo.SessionB),
                    ResolveSubSubPrincipios(m.Id, Microciclo.SessionB),
                    m.SesionBHabilidades);

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
