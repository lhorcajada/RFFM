using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Trainings.Exercises
{
    /// <summary>
    /// Lists exercises for a club, optionally filtered by sub-sub-principle.
    /// GET /api/trainings/exercises?clubId=&amp;subSubPrincipleId=
    /// </summary>
    public class GetExercises : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/trainings/exercises",
                    async (string clubId, string? subSubPrincipleId, HttpContext httpContext, IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        var result = await mediator.Send(new GetExercisesQuery(clubId, subSubPrincipleId, userId), ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetExercises))
                .WithTags(TrainingConstants.ExercisesTag)
                .RequireAuthorization()
                .Produces<IEnumerable<ExerciseListItem>>();
        }
    }

    public record GetExercisesQuery(string ClubId, string? SubSubPrincipleId, string UserId) : IRequest<IEnumerable<ExerciseListItem>>;

    public class GetExercisesHandler : IRequestHandler<GetExercisesQuery, IEnumerable<ExerciseListItem>>
    {
        private readonly AppDbContext _db;
        public GetExercisesHandler(AppDbContext db) => _db = db;

        public async ValueTask<IEnumerable<ExerciseListItem>> Handle(GetExercisesQuery request, CancellationToken ct = default)
        {
            var hasAccess = await _db.UserClubs
                .AnyAsync(uc => uc.ApplicationUserId == request.UserId && uc.ClubId == request.ClubId, ct);

            if (!hasAccess)
                throw new DomainException("Ejercicios", "No tienes acceso a este club.", "");

            var query = _db.TaskTrainingBases
                .Include(tb => tb.Skills)
                    .ThenInclude(s => s.EssentialSkill)
                .Include(tb => tb.SubSubPrinciple)
                .Include(tb => tb.Conditions)
                .Where(tb => tb.ClubId == request.ClubId);

            if (!string.IsNullOrEmpty(request.SubSubPrincipleId))
                query = query.Where(tb => tb.SubSubPrincipleId == request.SubSubPrincipleId);

            // Materialize first — EF Core cannot translate GetType() in a projection
            var entities = await query
                .OrderBy(tb => tb.Name)
                .ToListAsync(ct);

            return entities.Select(tb => new ExerciseListItem(
                tb.Id,
                tb.Name,
                tb.Description,
                tb.GetType().Name.Replace("TaskTraining", ""),
                tb.Section,
                tb.DurationTotal,
                tb.PlayersNumber,
                tb.GoalPeekersNumber,
                tb.FieldSpace,
                tb.SubSubPrincipleId,
                tb.SubSubPrinciple?.Name,
                tb.Skills.Select(s => new SkillCoverageDto(s.EssentialSkillId, s.EssentialSkill.Name)),
                tb.UrlImage,
                tb.BoardStateJson,
                tb.Conditions.OrderBy(c => c.Order).Select(c => new ConditionDto(c.Id, c.Text, c.Order))
            ));
        }
    }

    public record ExerciseListItem(
        string Id,
        string Name,
        string Description,
        string Type,
        string Section,
        int DurationTotal,
        int PlayersNumber,
        int GoalPeekersNumber,
        string FieldSpace,
        string? SubSubPrincipleId,
        string? SubSubPrincipleName,
        IEnumerable<SkillCoverageDto> Skills,
        string? UrlImage,
        string? BoardStateJson,
        IEnumerable<ConditionDto> Conditions);

    public record SkillCoverageDto(string EssentialSkillId, string SkillName);
}
