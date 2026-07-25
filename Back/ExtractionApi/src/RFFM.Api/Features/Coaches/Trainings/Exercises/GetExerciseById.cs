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

namespace RFFM.Api.Features.Coaches.Trainings.Exercises
{
    /// <summary>
    /// Gets a single exercise by id.
    /// GET /api/trainings/exercises/{id}
    /// </summary>
    public class GetExerciseById : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/trainings/exercises/{id}",
                    async (string id, HttpContext httpContext, IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        var result = await mediator.Send(new GetExerciseByIdQuery(id, userId), ct);
                        return result is null ? Results.NotFound() : Results.Ok(result);
                    })
                .WithName(nameof(GetExerciseById))
                .WithTags(TrainingConstants.ExercisesTag)
                .RequireAuthorization()
                .Produces<ExerciseListItem>()
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces(StatusCodes.Status404NotFound);
        }
    }

    public record GetExerciseByIdQuery(string ExerciseId, string UserId) : IRequest<ExerciseListItem?>, IRequireFeaturePermission
    {
        public string FeatureRoute => CoachFeatureRoutes.Trainings;
        public string RequiredPermission => "Read";
    }

    public class GetExerciseByIdHandler : IRequestHandler<GetExerciseByIdQuery, ExerciseListItem?>
    {
        private readonly AppDbContext _db;
        public GetExerciseByIdHandler(AppDbContext db) => _db = db;

        public async ValueTask<ExerciseListItem?> Handle(GetExerciseByIdQuery request, CancellationToken ct = default)
        {
            var exercise = await _db.TaskTrainingBases
                .Include(tb => tb.Skills)
                    .ThenInclude(s => s.EssentialSkill)
                .Include(tb => tb.Types)
                    .ThenInclude(t => t.ExerciseType)
                .Include(tb => tb.SubSubPrinciple)
                .Include(tb => tb.SubPrinciple)
                .Include(tb => tb.Conditions)
                .FirstOrDefaultAsync(tb => tb.Id == request.ExerciseId, ct);

            if (exercise is null)
                return null;

            var hasAccess = await _db.UserClubs
                .AnyAsync(uc => uc.ApplicationUserId == request.UserId && uc.ClubId == exercise.ClubId, ct);

            if (!hasAccess)
                throw new DomainException("Ejercicios", "No tienes acceso a este ejercicio.", ErrorCodes.ExerciseAccessDenied);

            return new ExerciseListItem(
                exercise.Id,
                exercise.Name,
                exercise.Description,
                exercise.Types.Select(t => t.ExerciseType.Name),
                exercise.Section,
                exercise.DurationTotal,
                exercise.PlayersNumber,
                exercise.GoalPeekersNumber,
                exercise.FieldSpace,
                exercise.SubSubPrincipleId,
                exercise.SubSubPrinciple?.Name,
                exercise.SubPrincipleId,
                exercise.SubPrinciple?.Name,
                exercise.Skills.Select(s => new SkillCoverageDto(s.EssentialSkillId, s.EssentialSkill.Name)),
                exercise.UrlImage,
                exercise.BoardStateJson,
                exercise.Conditions.OrderBy(c => c.Order).Select(c => new ConditionDto(c.Id, c.Text, c.Order))
            );
        }
    }
}