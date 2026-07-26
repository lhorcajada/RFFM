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
    /// Creates a new exercise in the club library.
    /// POST /api/trainings/exercises
    /// </summary>
    public class CreateExercise : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/trainings/exercises",
                    async (CreateExerciseCommand command, HttpContext httpContext, IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        var id = await mediator.Send(command with { UserId = userId }, ct);
                        return Results.Created($"/api/trainings/exercises/{id}", new { id });
                    })
                .WithName(nameof(CreateExercise))
                .WithTags(TrainingConstants.ExercisesTag)
                .RequireAuthorization()
                .Produces(StatusCodes.Status201Created)
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }
    }

    // ── Request ──────────────────────────────────────────────────────────────────

    /// <param name="Types">One or more of: Physical, Technical, Tactical, Game, Cognitive, Psychological</param>
    public record CreateExerciseCommand(
        string ClubId,
        string Name,
        string Description,
        List<string> Types,
        int DurationTotal,
        int PlayersNumber,
        int GoalPeekersNumber,
        string FieldSpace,
        string? SubSubPrincipleId,
        string? SubPrincipleId,
        string? ScenarioId,
        string Section,
        List<string> EssentialSkillIds,
        string? BoardStateJson,
        // Physical-specific
        int? Series,
        int? DurationSeries,
        int? RestSeries,
        // Technical/Tactical-specific
        int? TouchesNumber,
        int? WildCards
    ) : IRequest<string>, IRequireFeaturePermission
    {
        public string UserId { get; init; } = string.Empty;

        public string FeatureRoute => CoachFeatureRoutes.Trainings;
        public string RequiredPermission => "ReadWrite";
    }

    // ── Handler ──────────────────────────────────────────────────────────────────

    public class CreateExerciseHandler : IRequestHandler<CreateExerciseCommand, string>
    {
        private readonly AppDbContext _db;
        public CreateExerciseHandler(AppDbContext db) => _db = db;

        public async ValueTask<string> Handle(CreateExerciseCommand request, CancellationToken ct = default)
        {
            var hasAccess = await _db.UserClubs
                .AnyAsync(uc => uc.ApplicationUserId == request.UserId && uc.ClubId == request.ClubId, ct);

            if (!hasAccess)
                throw new DomainException("Ejercicios", "No tienes acceso a este club.", ErrorCodes.ClubAccessDenied);

            var exercise = new TaskTrainingBase
            {
                Name = request.Name.Trim(),
                Description = request.Description,
                DurationTotal = request.DurationTotal,
                PlayersNumber = request.PlayersNumber,
                GoalPeekersNumber = request.GoalPeekersNumber,
                FieldSpace = request.FieldSpace,
                ClubId = request.ClubId,
                SubSubPrincipleId = request.SubSubPrincipleId,
                SubPrincipleId = request.SubPrincipleId,
                ScenarioId = request.ScenarioId,
                Section = request.Section,
                BoardStateJson = request.BoardStateJson,
                Series = request.Series ?? 0,
                DurationSeries = request.DurationSeries ?? 0,
                RestSeries = request.RestSeries ?? 0,
                TouchesNumber = request.TouchesNumber ?? 0,
                WildCards = request.WildCards ?? 0,
            };

            foreach (var skillId in request.EssentialSkillIds.Distinct())
                exercise.Skills.Add(new TaskTrainingSkill { EssentialSkillId = skillId });

            var typeEntities = await _db.ExerciseTypes
                .Where(t => request.Types.Contains(t.Name))
                .ToListAsync(ct);
            foreach (var typeEntity in typeEntities)
                exercise.Types.Add(new TaskTrainingType { ExerciseTypeId = typeEntity.Id });

            await _db.TaskTrainingBases.AddAsync(exercise, ct);
            await _db.SaveChangesAsync(ct);
            return exercise.Id;
        }
    }

    // ── Validator ────────────────────────────────────────────────────────────────

    public class CreateExerciseValidator : AbstractValidator<CreateExerciseCommand>
    {
        public CreateExerciseValidator()
        {
            RuleFor(x => x.ClubId).NotEmpty();
            RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
            RuleFor(x => x.Types).NotEmpty()
                .WithMessage("At least one type is required.");
            RuleForEach(x => x.Types)
                .Must(t => ExerciseTypesSeeder.Types.Contains(t))
                .WithMessage("Type must be one of: " + "Physical, Technical, Tactical, Game, Cognitive, Psychological");
            RuleFor(x => x.Section).Must(s => s is "Calentamiento" or "Principal" or "VueltaALaCalma")
                .WithMessage("Section must be Calentamiento, Principal or VueltaALaCalma.");
            RuleFor(x => x.DurationTotal).GreaterThan(0);
            RuleFor(x => x)
                .Must(x => new[] { x.ScenarioId, x.SubPrincipleId, x.SubSubPrincipleId }
                    .Count(id => !string.IsNullOrEmpty(id)) <= 1)
                .WithMessage("At most one of ScenarioId, SubPrincipleId or SubSubPrincipleId may be provided.");
        }
    }
}
