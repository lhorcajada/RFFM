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

    /// <param name="Type">Physical | Technical | Tactical</param>
    public record CreateExerciseCommand(
        string ClubId,
        string Name,
        string Description,
        string Type,
        int DurationTotal,
        int PlayersNumber,
        int GoalPeekersNumber,
        string FieldSpace,
        string? SubSubPrincipleId,
        string Section,
        List<string> EssentialSkillIds,
        // Physical-specific
        int? Series,
        int? DurationSeries,
        int? RestSeries,
        // Technical/Tactical-specific
        int? TouchesNumber,
        int? WildCards
    ) : IRequest<string>
    {
        public string UserId { get; init; } = string.Empty;
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
                throw new DomainException("Ejercicios", "No tienes acceso a este club.", "");

            TaskTrainingBase exercise = request.Type switch
            {
                "Physical" => new PhysicalTaskTraining
                {
                    Series = request.Series ?? 1,
                    DurationSeries = request.DurationSeries ?? 0,
                    RestSeries = request.RestSeries ?? 0,
                },
                "Technical" => new TechnicalTaskTraining
                {
                    TouchesNumber = request.TouchesNumber ?? 0,
                    WildCards = request.WildCards ?? 0,
                },
                _ => new TacticalTaskTraining
                {
                    TouchesNumber = request.TouchesNumber ?? 0,
                    WildCards = request.WildCards ?? 0,
                }
            };

            exercise.Name = request.Name.Trim();
            exercise.Description = request.Description;
            exercise.DurationTotal = request.DurationTotal;
            exercise.PlayersNumber = request.PlayersNumber;
            exercise.GoalPeekersNumber = request.GoalPeekersNumber;
            exercise.FieldSpace = request.FieldSpace;
            exercise.ClubId = request.ClubId;
            exercise.SubSubPrincipleId = request.SubSubPrincipleId;
            exercise.Section = request.Section;

            foreach (var skillId in request.EssentialSkillIds.Distinct())
                exercise.Skills.Add(new TaskTrainingSkill { EssentialSkillId = skillId });

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
            RuleFor(x => x.Type).Must(t => t is "Physical" or "Technical" or "Tactical")
                .WithMessage("Type must be Physical, Technical or Tactical.");
            RuleFor(x => x.Section).Must(s => s is "Calentamiento" or "Principal" or "VueltaALaCalma")
                .WithMessage("Section must be Calentamiento, Principal or VueltaALaCalma.");
            RuleFor(x => x.DurationTotal).GreaterThan(0);
        }
    }
}
