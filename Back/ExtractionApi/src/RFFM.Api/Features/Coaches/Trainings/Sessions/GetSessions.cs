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
    /// Lists training sessions for a team, optionally filtered by sub-principle.
    /// GET /api/trainings/sessions?teamId=&amp;subPrincipleId=
    /// </summary>
    public class GetSessions : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/trainings/sessions",
                    async (string teamId, string? subPrincipleId, HttpContext httpContext, IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        var result = await mediator.Send(new GetSessionsQuery(teamId, subPrincipleId, userId), ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetSessions))
                .WithTags(TrainingConstants.SessionsTag)
                .RequireAuthorization()
                .Produces<IEnumerable<SessionListItem>>();
        }
    }

    public record GetSessionsQuery(string TeamId, string? SubPrincipleId, string UserId) : IRequest<IEnumerable<SessionListItem>>, IRequireFeaturePermission
    {
        public string FeatureRoute => CoachFeatureRoutes.Trainings;
        public string RequiredPermission => "Read";
    }

    public record SessionListItem(
        string Id,
        string Name,
        string Description,
        DateTime Date,
        TimeSpan StartTime,
        TimeSpan? EndTime,
        string? Location,
        string? SportEventId,
        string? SportEventName,
        string? SubPrincipleId,
        string? SubPrincipleName,
        int ExerciseCount);

    public class GetSessionsHandler : IRequestHandler<GetSessionsQuery, IEnumerable<SessionListItem>>
    {
        private readonly AppDbContext _db;
        public GetSessionsHandler(AppDbContext db) => _db = db;

        public async ValueTask<IEnumerable<SessionListItem>> Handle(GetSessionsQuery request, CancellationToken ct = default)
        {
            var hasAccess = await _db.UserClubs
                .Join(_db.Teams, uc => uc.ClubId, t => t.ClubId, (uc, t) => new { uc, t })
                .AnyAsync(x => x.uc.ApplicationUserId == request.UserId && x.t.Id == request.TeamId, ct);

            if (!hasAccess)
                throw new DomainException("Sesiones", "No tienes acceso a este equipo.", ErrorCodes.TeamAccessDenied);

            var query = _db.TrainingSessions
                .Include(s => s.Tasks)
                .Include(s => s.SportEvent)
                .Include(s => s.SubPrinciple)
                .Where(s => s.TeamId == request.TeamId);

            if (!string.IsNullOrEmpty(request.SubPrincipleId))
                query = query.Where(s => s.SubPrincipleId == request.SubPrincipleId);

            var sessions = await query
                .OrderByDescending(s => s.Date)
                .Select(s => new SessionListItem(
                    s.Id,
                    s.Name,
                    s.Description,
                    s.Date,
                    s.StartTime,
                    s.EndTime,
                    s.Location,
                    s.SportEventId,
                    s.SportEvent != null ? s.SportEvent.Name : null,
                    s.SubPrincipleId,
                    s.SubPrinciple != null ? s.SubPrinciple.Name : null,
                    s.Tasks.Count))
                .ToListAsync(ct);

            return sessions;
        }
    }
}
