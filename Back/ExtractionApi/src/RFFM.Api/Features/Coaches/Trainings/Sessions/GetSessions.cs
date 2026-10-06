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

namespace RFFM.Api.Features.Coaches.Trainings.Sessions
{
    /// <summary>
    /// Lists training sessions for a team, optionally restricted to a season.
    /// GET /api/trainings/sessions?teamId=&amp;seasonId=
    /// </summary>
    public class GetSessions : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/trainings/sessions",
                    async (string teamId, string? seasonId, HttpContext httpContext, IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        var result = await mediator.Send(new GetSessionsQuery(teamId, userId, seasonId), ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetSessions))
                .WithTags(TrainingConstants.SessionsTag)
                .RequireAuthorization()
                .Produces<IEnumerable<SessionListItem>>();
        }
    }

    public record GetSessionsQuery(string TeamId, string UserId, string? SeasonId = null)
        : IRequest<IEnumerable<SessionListItem>>, IRequireFeaturePermission
    {
        public string FeatureRoute => CoachFeatureRoutes.Trainings;
        public string RequiredPermission => "Read";
    }

    public record SessionListItem(
        string Id,
        string Name,
        string Description,
        DateTime? Date,
        TimeSpan? StartTime,
        TimeSpan? EndTime,
        string? Location,
        string? SportEventId,
        string? SportEventName,
        int ExerciseCount,
        bool IsAssociatedToPlan,
        string? MicrocicloId,
        string? MicrocicloWeekLabel,
        IEnumerable<SessionTargetDetail> Targets,
        int? MicrocicloOrder = null,
        DateOnly? MicrocicloStartDate = null,
        DateOnly? MicrocicloEndDate = null,
        string? MesocicloId = null,
        string? MesocicloName = null,
        int? MesocicloOrder = null,
        string? MacrocicloId = null,
        string? MacrocicloName = null,
        int? MacrocicloOrder = null);

    public class GetSessionsHandler : IRequestHandler<GetSessionsQuery, IEnumerable<SessionListItem>>
    {
        private readonly AppDbContext _db;
        public GetSessionsHandler(AppDbContext db) => _db = db;

        private record MicrocicloInfo(
            string Id, string WeekLabel, int Order, DateOnly StartDate, DateOnly EndDate,
            string MesocicloId, string MesocicloName, int MesocicloOrder,
            string MacrocicloId, string MacrocicloName, int MacrocicloOrder);

        public async ValueTask<IEnumerable<SessionListItem>> Handle(GetSessionsQuery request, CancellationToken ct = default)
        {
            var hasAccess = await _db.UserClubs
                .Join(_db.Teams, uc => uc.ClubId, t => t.ClubId, (uc, t) => new { uc, t })
                .AnyAsync(x => x.uc.ApplicationUserId == request.UserId && x.t.Id == request.TeamId, ct);

            if (!hasAccess)
                throw new DomainException("Sesiones", "No tienes acceso a este equipo.", ErrorCodes.TeamAccessDenied);

            var query = _db.TrainingSessions.Where(s => s.TeamId == request.TeamId);

            if (!string.IsNullOrEmpty(request.SeasonId))
            {
                var season = await _db.Seasons
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => s.Id == request.SeasonId, ct)
                    ?? throw new DomainException("Sesiones", "Temporada no encontrada.", ErrorCodes.SeasonNotFound);

                var seasonMicrocicloIds = _db.Microciclos
                    .Join(_db.Mesociclos, mi => mi.MesocicloId, me => me.Id, (mi, me) => new { mi, me })
                    .Join(_db.Macrociclos, x => x.me.MacrocicloId, ma => ma.Id, (x, ma) => new { x.mi, ma })
                    .Join(_db.SeasonPlans, x => x.ma.SeasonPlanId, p => p.Id, (x, p) => new { x.mi, p })
                    .Where(x => x.p.TeamId == request.TeamId && x.p.SeasonId == request.SeasonId)
                    .Select(x => x.mi.Id);

                var seasonStart = season.StartDate.Date;
                var seasonEndExclusive = season.EndDate.Date.AddDays(1);

                query = query.Where(s => s.MicrocicloId != null
                    ? seasonMicrocicloIds.Contains(s.MicrocicloId)
                    : s.Date == null || (s.Date >= seasonStart && s.Date < seasonEndExclusive));
            }

            var sessions = await query
                .Include(s => s.Blocks)
                    .ThenInclude(b => b.Exercises)
                .Include(s => s.SportEvent)
                .Include(s => s.Targets)
                .AsSplitQuery()
                // Unscheduled sessions (Date == null) sort first, then most-recent-dated first —
                // keeps the content-board's unscheduled board sessions grouped predictably
                // (design.md tasks.md 5.3) rather than relying on default null-ordering.
                .OrderByDescending(s => s.Date == null)
                .ThenByDescending(s => s.Date)
                .ToListAsync(ct);

            var microcicloIds = sessions.Where(s => s.MicrocicloId != null).Select(s => s.MicrocicloId!).Distinct().ToList();
            var microciclos = await _db.Microciclos
                .AsNoTracking()
                .Where(m => microcicloIds.Contains(m.Id))
                .Join(_db.Mesociclos, mi => mi.MesocicloId, me => me.Id, (mi, me) => new { mi, me })
                .Join(_db.Macrociclos, x => x.me.MacrocicloId, ma => ma.Id, (x, ma) => new MicrocicloInfo(
                    x.mi.Id, x.mi.WeekLabel, x.mi.Order, x.mi.StartDate, x.mi.EndDate,
                    x.me.Id, x.me.Name, x.me.Order,
                    ma.Id, ma.Name, ma.Order))
                .ToDictionaryAsync(m => m.Id, ct);

            var targetDetails = await SessionTargetDetailLookup.ResolveAsync(
                _db, sessions.SelectMany(s => s.Targets).Select(t => t.SubSubPrincipioId), ct);

            return sessions.Select(s =>
            {
                var micro = s.MicrocicloId != null ? microciclos.GetValueOrDefault(s.MicrocicloId) : null;
                return new SessionListItem(
                    s.Id,
                    s.Name,
                    s.Description,
                    s.Date,
                    s.StartTime,
                    s.EndTime,
                    s.Location,
                    s.SportEventId,
                    s.SportEvent?.Name,
                    s.Blocks.SelectMany(b => b.Exercises).Select(e => e.TaskTrainingBaseId).Distinct().Count(),
                    s.MicrocicloId != null,
                    s.MicrocicloId,
                    micro?.WeekLabel,
                    s.Targets.Select(t => targetDetails.GetValueOrDefault(t.SubSubPrincipioId)).Where(t => t is not null)!,
                    micro?.Order,
                    micro?.StartDate,
                    micro?.EndDate,
                    micro?.MesocicloId,
                    micro?.MesocicloName,
                    micro?.MesocicloOrder,
                    micro?.MacrocicloId,
                    micro?.MacrocicloName,
                    micro?.MacrocicloOrder);
            });
        }
    }
}
