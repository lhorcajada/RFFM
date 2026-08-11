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
    /// Lists training sessions for a team.
    /// GET /api/trainings/sessions?teamId=
    /// </summary>
    public class GetSessions : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/trainings/sessions",
                    async (string teamId, HttpContext httpContext, IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        var result = await mediator.Send(new GetSessionsQuery(teamId, userId), ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetSessions))
                .WithTags(TrainingConstants.SessionsTag)
                .RequireAuthorization()
                .Produces<IEnumerable<SessionListItem>>();
        }
    }

    public record GetSessionsQuery(string TeamId, string UserId) : IRequest<IEnumerable<SessionListItem>>, IRequireFeaturePermission
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

            var sessions = await _db.TrainingSessions
                .Include(s => s.Tasks)
                .Include(s => s.SportEvent)
                .Where(s => s.TeamId == request.TeamId)
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
                    s.Tasks.Count))
                .ToListAsync(ct);

            return sessions;
        }
    }
}
