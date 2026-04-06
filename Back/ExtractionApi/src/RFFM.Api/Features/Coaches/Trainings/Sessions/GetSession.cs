using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Trainings.Exercises;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Trainings.Sessions
{
    /// <summary>
    /// Get a single session with its exercises.
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

    public record GetSessionQuery(string Id, string UserId) : IRequest<SessionDetail?>;

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
        IEnumerable<SessionExerciseItem> Exercises);

    public record SessionExerciseItem(
        string TaskTrainingId,
        int Order,
        string ExerciseId,
        string Name,
        string Description,
        string Type,
        string Section,
        int DurationTotal,
        int PlayersNumber,
        int GoalPeekersNumber,
        string FieldSpace,
        string? UrlImage,
        IEnumerable<SkillCoverageDto> Skills,
        IEnumerable<ConditionDto> Conditions);

    public class GetSessionHandler : IRequestHandler<GetSessionQuery, SessionDetail?>
    {
        private readonly AppDbContext _db;
        public GetSessionHandler(AppDbContext db) => _db = db;

        public async ValueTask<SessionDetail?> Handle(GetSessionQuery request, CancellationToken ct = default)
        {
            var session = await _db.TrainingSessions
                .Include(s => s.SportEvent)
                .Include(s => s.Tasks)
                    .ThenInclude(tt => tt.Task)
                        .ThenInclude(tb => tb.Skills)
                            .ThenInclude(sk => sk.EssentialSkill)
                .Include(s => s.Tasks)
                    .ThenInclude(tt => tt.Task)
                        .ThenInclude(tb => tb.Conditions)
                .AsSplitQuery()
                .FirstOrDefaultAsync(s => s.Id == request.Id, ct);

            if (session is null) return null;

            var hasAccess = await _db.UserClubs
                .Join(_db.Teams, uc => uc.ClubId, t => t.ClubId, (uc, t) => new { uc, t })
                .AnyAsync(x => x.uc.ApplicationUserId == request.UserId && x.t.Id == session.TeamId, ct);

            if (!hasAccess)
                throw new DomainException("Sesiones", "No tienes acceso a esta sesión.", "");

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
                session.Tasks
                    .OrderBy(tt => tt.Order)
                    .Select(tt => new SessionExerciseItem(
                        tt.Id,
                        tt.Order,
                        tt.Task.Id,
                        tt.Task.Name,
                        tt.Task.Description,
                        tt.Task.GetType().Name.Replace("TaskTraining", ""),
                        tt.Section,
                        tt.Task.DurationTotal,
                        tt.Task.PlayersNumber,
                        tt.Task.GoalPeekersNumber,
                        tt.Task.FieldSpace,
                        tt.Task.UrlImage,
                        tt.Task.Skills.Select(sk => new SkillCoverageDto(sk.EssentialSkillId, sk.EssentialSkill.Name)),
                        tt.Task.Conditions.OrderBy(c => c.Order).Select(c => new ConditionDto(c.Id, c.Text, c.Order))
                    ))
            );
        }
    }
}
