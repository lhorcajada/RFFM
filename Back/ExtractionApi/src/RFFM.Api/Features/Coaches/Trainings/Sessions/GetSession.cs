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

namespace RFFM.Api.Features.Coaches.Trainings.Sessions
{
    /// <summary>
    /// Get a single session with its blocks and their exercises.
    /// GET /api/trainings/sessions/{id}
    /// </summary>
    public class GetSession : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/trainings/sessions/{id}",
                    async (string id, HttpContext httpContext, IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        var result = await mediator.Send(new GetSessionQuery(id, userId), ct);
                        return result is null ? Results.NotFound() : Results.Ok(result);
                    })
                .WithName(nameof(GetSession))
                .WithTags(TrainingConstants.SessionsTag)
                .RequireAuthorization()
                .Produces<SessionDetail>()
                .Produces(StatusCodes.Status404NotFound);
        }
    }

    public record GetSessionQuery(string Id, string UserId) : IRequest<SessionDetail?>, IRequireFeaturePermission
    {
        public string FeatureRoute => CoachFeatureRoutes.Trainings;
        public string RequiredPermission => "Read";
    }

    public record SessionDetail(
        string Id,
        string Name,
        string Description,
        DateTime? Date,
        TimeSpan? StartTime,
        TimeSpan? EndTime,
        string? Location,
        string? SportEventId,
        string? SportEventName,
        string? MicrocicloId,
        string? MicrocicloWeekLabel,
        bool IsAssociatedToPlan,
        string? ObjetivoGeneral,
        string? MapaCampoTexto,
        string? UrlImage,
        IEnumerable<SessionBlockDetail> Blocks,
        IEnumerable<SessionTargetDetail> Targets);

    /// <summary>One Sub-subprincipio target of a <see cref="Domain.Aggregates.Training.TrainingSession"/>,
    /// with its full ADN breadcrumb inlined (Fase › Principio › Subprincipio › Zona › Rol) so
    /// callers never need a second lookup against <c>GetGameModel</c> to render a target chip's
    /// text — design.md Decision 3 of `season-plan-content-board`.</summary>
    public record SessionTargetDetail(
        string SubSubPrincipioId,
        string Rol,
        string Numero,
        string SubprincipioId,
        string SubprincipioTitulo,
        string? ZonaId,
        string? ZonaLabel,
        string PrincipioId,
        string PrincipioTitulo,
        int GameMomentId,
        string GameMomentName);

    public record SessionBlockDetail(
        string Id,
        int Order,
        string Nombre,
        string ComoConectaConAnterior,
        string? RotacionEntreEjercicios,
        IEnumerable<SessionBlockExerciseDetail> Exercises);

    /// <summary>Summary DTO for an exercise placed in a block — full exercise detail (Niveles,
    /// ModelRelations, etc.) is a separate <c>GetExerciseById</c> call, avoiding duplicating the
    /// whole payload per block (design.md §4).</summary>
    public record SessionBlockExerciseDetail(
        string Id,
        string ExerciseId,
        int Position,
        string Name,
        string Tipo,
        string Objetivo,
        int? DurationMinutes,
        string? UrlImage);

    public class GetSessionHandler : IRequestHandler<GetSessionQuery, SessionDetail?>
    {
        private readonly AppDbContext _db;
        public GetSessionHandler(AppDbContext db) => _db = db;

        public async ValueTask<SessionDetail?> Handle(GetSessionQuery request, CancellationToken ct = default)
        {
            var session = await _db.TrainingSessions
                .Include(s => s.SportEvent)
                .Include(s => s.Blocks)
                    .ThenInclude(b => b.Exercises)
                        .ThenInclude(e => e.Exercise)
                .Include(s => s.Targets)
                .AsSplitQuery()
                .FirstOrDefaultAsync(s => s.Id == request.Id, ct);

            if (session is null) return null;

            var hasAccess = await _db.UserClubs
                .Join(_db.Teams, uc => uc.ClubId, t => t.ClubId, (uc, t) => new { uc, t })
                .AnyAsync(x => x.uc.ApplicationUserId == request.UserId && x.t.Id == session.TeamId, ct);

            if (!hasAccess)
                throw new DomainException("Sesiones", "No tienes acceso a esta sesión.", ErrorCodes.SessionAccessDenied);

            string? weekLabel = null;
            if (session.MicrocicloId is not null)
                weekLabel = await _db.Microciclos
                    .AsNoTracking()
                    .Where(m => m.Id == session.MicrocicloId)
                    .Select(m => m.WeekLabel)
                    .FirstOrDefaultAsync(ct);

            var targetDetails = await SessionTargetDetailLookup.ResolveAsync(
                _db, session.Targets.Select(t => t.SubSubPrincipioId), ct);

            return new SessionDetail(
                session.Id,
                session.Name,
                session.Description,
                session.Date,
                session.StartTime,
                session.EndTime,
                session.Location,
                session.SportEventId,
                session.SportEvent?.Name,
                session.MicrocicloId,
                weekLabel,
                session.MicrocicloId != null,
                session.ObjetivoGeneral,
                session.MapaCampoTexto,
                session.UrlImage,
                session.Blocks
                    .OrderBy(b => b.Order)
                    .Select(b => new SessionBlockDetail(
                        b.Id, b.Order, b.Nombre, b.ComoConectaConAnterior, b.RotacionEntreEjercicios,
                        b.Exercises
                            .OrderBy(e => e.Position)
                            .Select(e => new SessionBlockExerciseDetail(
                                e.Id, e.TaskTrainingBaseId, e.Position,
                                e.Exercise.Name, e.Exercise.Tipo, e.Exercise.Objetivo,
                                e.Exercise.DurationMinutes, e.Exercise.UrlImage)))),
                session.Targets
                    .Select(t => targetDetails.GetValueOrDefault(t.SubSubPrincipioId))
                    .Where(t => t is not null)!
            );
        }
    }

    /// <summary>Resolves the full ADN breadcrumb (design.md Decision 3) for a set of
    /// SubSubPrincipio ids, shared by <see cref="GetSessionHandler"/>,
    /// <see cref="GetSessionsHandler"/> and <c>GetSeasonPlan</c>'s weekly-objective projection.
    /// An id that no longer resolves (SubSubPrincipio removed from the GameModel after a
    /// session targeted it — should not happen given the cascade FK, but tolerated defensively)
    /// is simply absent from the result.</summary>
    internal static class SessionTargetDetailLookup
    {
        public static async Task<IReadOnlyDictionary<string, SessionTargetDetail>> ResolveAsync(
            AppDbContext db, IEnumerable<string> subSubPrincipioIds, CancellationToken ct)
        {
            var ids = subSubPrincipioIds.Distinct().ToList();
            if (ids.Count == 0)
                return new Dictionary<string, SessionTargetDetail>();

            var rows = await db.SubSubPrincipios
                .AsNoTracking()
                .Where(ssp => ids.Contains(ssp.Id))
                .Select(ssp => new
                {
                    ssp.Id,
                    ssp.Rol,
                    ssp.Numero,
                    SubprincipioId = ssp.SubprincipioId ?? (ssp.Zona != null ? ssp.Zona.SubprincipioId : null),
                    ZonaId = ssp.ZonaId,
                    ZonaLabel = ssp.Zona != null ? (ssp.Zona.Label ?? ssp.Zona.ZoneKeysCsv) : null,
                })
                .ToListAsync(ct);

            var subprincipioIds = rows
                .Where(r => r.SubprincipioId is not null)
                .Select(r => r.SubprincipioId!)
                .Distinct()
                .ToList();

            var subprincipioInfos = await db.Subprincipios
                .AsNoTracking()
                .Where(sp => subprincipioIds.Contains(sp.Id))
                .Select(sp => new
                {
                    sp.Id,
                    sp.Titulo,
                    PrincipioId = sp.GamePrincipleId,
                    PrincipioTitulo = sp.GamePrinciple.Titulo,
                    GameMomentId = sp.GamePrinciple.GameMomentId,
                    GameMomentName = sp.GamePrinciple.GameMoment.Name,
                })
                .ToDictionaryAsync(x => x.Id, ct);

            var result = new Dictionary<string, SessionTargetDetail>();
            foreach (var row in rows)
            {
                if (row.SubprincipioId is null) continue;
                if (!subprincipioInfos.TryGetValue(row.SubprincipioId, out var sp)) continue;

                result[row.Id] = new SessionTargetDetail(
                    row.Id, row.Rol, row.Numero,
                    sp.Id, sp.Titulo,
                    row.ZonaId, row.ZonaLabel,
                    sp.PrincipioId, sp.PrincipioTitulo,
                    sp.GameMomentId, sp.GameMomentName);
            }

            return result;
        }
    }
}
