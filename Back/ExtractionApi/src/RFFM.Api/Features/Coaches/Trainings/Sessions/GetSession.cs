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
        DateTime Date,
        TimeSpan StartTime,
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
        IEnumerable<SessionBlockDetail> Blocks);

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
                                e.Exercise.DurationMinutes, e.Exercise.UrlImage))))
            );
        }
    }
}
