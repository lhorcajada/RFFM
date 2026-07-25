using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Persistence.Seed;

namespace RFFM.Api.Features.Coaches.Trainings.Exercises
{
    /// <summary>
    /// Updates an existing exercise.
    /// PUT /api/trainings/exercises/{id}
    /// </summary>
    public class UpdateExercise : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/trainings/exercises/{id}",
                    async (string id, UpdateExerciseCommand command, HttpContext httpContext, IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        await mediator.Send(command with { Id = id, UserId = userId }, ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(UpdateExercise))
                .WithTags(TrainingConstants.ExercisesTag)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status404NotFound)
                .Produces(StatusCodes.Status401Unauthorized);
        }
    }

    public record UpdateExerciseCommand(
        string Name,
        string Description,
        List<string> Types,
        int DurationTotal,
        int PlayersNumber,
        int GoalPeekersNumber,
        string FieldSpace,
        string? SubSubPrincipleId,
        string? SubPrincipleId,
        string Section,
        List<string> EssentialSkillIds,
        string? BoardStateJson,
        int? Series,
        int? DurationSeries,
        int? RestSeries,
        int? TouchesNumber,
        int? WildCards
    ) : IRequest, IRequireFeaturePermission
    {
        public string Id { get; init; } = string.Empty;
        public string UserId { get; init; } = string.Empty;

        public string FeatureRoute => CoachFeatureRoutes.Trainings;
        public string RequiredPermission => "ReadWrite";
    }

    public class UpdateExerciseHandler : IRequestHandler<UpdateExerciseCommand, Unit>
    {
        private readonly AppDbContext _db;
        public UpdateExerciseHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(UpdateExerciseCommand request, CancellationToken ct = default)
        {
            var exercise = await _db.TaskTrainingBases
                .Include(tb => tb.Skills)
                .Include(tb => tb.Types)
                .FirstOrDefaultAsync(tb => tb.Id == request.Id, ct);

            if (exercise is null)
                throw new DomainException("Ejercicios", "Ejercicio no encontrado.", ErrorCodes.ExerciseNotFound);

            var hasAccess = await _db.UserClubs
                .AnyAsync(uc => uc.ApplicationUserId == request.UserId && uc.ClubId == exercise.ClubId, ct);
            if (!hasAccess)
                throw new DomainException("Ejercicios", "No tienes acceso a este ejercicio.", ErrorCodes.ExerciseAccessDenied);

            exercise.Name = request.Name.Trim();
            exercise.Description = request.Description;
            exercise.DurationTotal = request.DurationTotal;
            exercise.PlayersNumber = request.PlayersNumber;
            exercise.GoalPeekersNumber = request.GoalPeekersNumber;
            exercise.FieldSpace = request.FieldSpace;
            exercise.SubSubPrincipleId = request.SubSubPrincipleId;
            exercise.SubPrincipleId = request.SubPrincipleId;
            exercise.Section = request.Section;
            if (request.BoardStateJson is not null)
                exercise.BoardStateJson = request.BoardStateJson;

            exercise.Series = request.Series ?? exercise.Series;
            exercise.DurationSeries = request.DurationSeries ?? exercise.DurationSeries;
            exercise.RestSeries = request.RestSeries ?? exercise.RestSeries;
            exercise.TouchesNumber = request.TouchesNumber ?? exercise.TouchesNumber;
            exercise.WildCards = request.WildCards ?? exercise.WildCards;

            // Replace skills
            _db.TaskTrainingSkills.RemoveRange(exercise.Skills);
            exercise.Skills.Clear();
            foreach (var skillId in request.EssentialSkillIds.Distinct())
                exercise.Skills.Add(new TaskTrainingSkill { TaskTrainingBaseId = exercise.Id, EssentialSkillId = skillId });

            // Replace types
            _db.TaskTrainingTypes.RemoveRange(exercise.Types);
            exercise.Types.Clear();
            var typeEntities = await _db.ExerciseTypes
                .Where(t => request.Types.Contains(t.Name))
                .ToListAsync(ct);
            foreach (var typeEntity in typeEntities)
                exercise.Types.Add(new TaskTrainingType { TaskTrainingBaseId = exercise.Id, ExerciseTypeId = typeEntity.Id });

            await _db.SaveChangesAsync(ct);
            return Unit.Value;
        }
    }

    public class UpdateExerciseValidator : AbstractValidator<UpdateExerciseCommand>
    {
        public UpdateExerciseValidator()
        {
            RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
            RuleFor(x => x.Types).NotEmpty()
                .WithMessage("At least one type is required.");
            RuleForEach(x => x.Types)
                .Must(t => ExerciseTypesSeeder.Types.Contains(t))
                .WithMessage("Type must be one of: " + "Physical, Technical, Tactical, Game, Cognitive, Psychological");
            RuleFor(x => x.DurationTotal).GreaterThan(0);
            RuleFor(x => x.Section).Must(s => s is "Calentamiento" or "Principal" or "VueltaALaCalma")
                .WithMessage("Section must be Calentamiento, Principal or VueltaALaCalma.");
            RuleFor(x => x)
                .Must(x => string.IsNullOrEmpty(x.SubSubPrincipleId) != string.IsNullOrEmpty(x.SubPrincipleId))
                .WithMessage("Exactly one of SubSubPrincipleId or SubPrincipleId must be provided.");
        }
    }
}
