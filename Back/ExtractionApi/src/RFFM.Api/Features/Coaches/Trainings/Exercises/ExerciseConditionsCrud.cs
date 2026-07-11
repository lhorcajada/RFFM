using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Trainings.Exercises
{
    /// <summary>
    /// POST   /api/trainings/exercises/{exerciseId}/conditions
    /// PUT    /api/trainings/exercises/conditions/{conditionId}
    /// DELETE /api/trainings/exercises/conditions/{conditionId}
    /// </summary>
    public class ExerciseConditionsCrud : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/trainings/exercises/{exerciseId}/conditions",
                    async (string exerciseId, CreateConditionRequest req, HttpContext httpContext,
                        IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = GetUserId(httpContext);
                        if (userId is null) return Results.Unauthorized();
                        var result = await mediator.Send(new CreateConditionCommand(exerciseId, req.Text, userId), ct);
                        return Results.Ok(result);
                    })
                .WithName("CreateExerciseCondition")
                .WithTags(TrainingConstants.ExercisesTag)
                .RequireAuthorization()
                .Produces<ConditionDto>();

            app.MapPut("/api/trainings/exercises/conditions/{conditionId}",
                    async (string conditionId, UpdateConditionRequest req, HttpContext httpContext,
                        IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = GetUserId(httpContext);
                        if (userId is null) return Results.Unauthorized();
                        var result = await mediator.Send(new UpdateConditionCommand(conditionId, req.Text, userId), ct);
                        return Results.Ok(result);
                    })
                .WithName("UpdateExerciseCondition")
                .WithTags(TrainingConstants.ExercisesTag)
                .RequireAuthorization()
                .Produces<ConditionDto>();

            app.MapDelete("/api/trainings/exercises/conditions/{conditionId}",
                    async (string conditionId, HttpContext httpContext,
                        IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = GetUserId(httpContext);
                        if (userId is null) return Results.Unauthorized();
                        await mediator.Send(new DeleteConditionCommand(conditionId, userId), ct);
                        return Results.NoContent();
                    })
                .WithName("DeleteExerciseCondition")
                .WithTags(TrainingConstants.ExercisesTag)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent);
        }

        private static string? GetUserId(HttpContext ctx) =>
            ctx.User.Claims
                .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
    }

    // ── Records ──────────────────────────────────────────────────────────

    public record ConditionDto(string Id, string Text, int Order);

    public record CreateConditionRequest(string Text);
    public record UpdateConditionRequest(string Text);

    // ── Commands ─────────────────────────────────────────────────────────

    public record CreateConditionCommand(string ExerciseId, string Text, string UserId)
        : IRequest<ConditionDto>;

    public record UpdateConditionCommand(string ConditionId, string Text, string UserId)
        : IRequest<ConditionDto>;

    public record DeleteConditionCommand(string ConditionId, string UserId)
        : IRequest<Unit>;

    // ── Handlers ─────────────────────────────────────────────────────────

    public class CreateConditionHandler : IRequestHandler<CreateConditionCommand, ConditionDto>
    {
        private readonly AppDbContext _db;
        public CreateConditionHandler(AppDbContext db) => _db = db;

        public async ValueTask<ConditionDto> Handle(CreateConditionCommand request, CancellationToken ct = default)
        {
            var exercise = await _db.TaskTrainingBases
                .FirstOrDefaultAsync(tb => tb.Id == request.ExerciseId, ct);

            if (exercise is null)
                throw new Domain.DomainException("Condiciones", $"Ejercicio no encontrado: {request.ExerciseId}", Domain.ErrorCodes.ExerciseNotFound);

            var hasAccess = await _db.UserClubs
                .AnyAsync(uc => uc.ApplicationUserId == request.UserId && uc.ClubId == exercise.ClubId, ct);

            if (!hasAccess)
                throw new Domain.DomainException("Condiciones", "No tienes acceso a este ejercicio.", Domain.ErrorCodes.ExerciseAccessDenied);

            var nextOrder = await _db.ExerciseConditions
                .Where(c => c.TaskTrainingBaseId == request.ExerciseId)
                .CountAsync(ct);

            var condition = new ExerciseCondition
            {
                Id = Guid.NewGuid().ToString(),
                TaskTrainingBaseId = request.ExerciseId,
                Text = request.Text.Trim(),
                Order = nextOrder,
            };

            await _db.ExerciseConditions.AddAsync(condition, ct);
            await _db.SaveChangesAsync(ct);

            return new ConditionDto(condition.Id, condition.Text, condition.Order);
        }
    }

    public class UpdateConditionHandler : IRequestHandler<UpdateConditionCommand, ConditionDto>
    {
        private readonly AppDbContext _db;
        public UpdateConditionHandler(AppDbContext db) => _db = db;

        public async ValueTask<ConditionDto> Handle(UpdateConditionCommand request, CancellationToken ct = default)
        {
            var condition = await _db.ExerciseConditions
                .Include(c => c.TaskTrainingBase)
                .FirstOrDefaultAsync(c => c.Id == request.ConditionId, ct);

            if (condition is null)
                throw new Domain.DomainException("Condiciones", $"Condición no encontrada: {request.ConditionId}", Domain.ErrorCodes.ExerciseConditionNotFound);

            var hasAccess = await _db.UserClubs
                .AnyAsync(uc => uc.ApplicationUserId == request.UserId && uc.ClubId == condition.TaskTrainingBase.ClubId, ct);

            if (!hasAccess)
                throw new Domain.DomainException("Condiciones", "No tienes acceso a esta condición.", Domain.ErrorCodes.ExerciseConditionAccessDenied);

            condition.Text = request.Text.Trim();
            await _db.SaveChangesAsync(ct);

            return new ConditionDto(condition.Id, condition.Text, condition.Order);
        }
    }

    public class DeleteConditionHandler : IRequestHandler<DeleteConditionCommand, Unit>
    {
        private readonly AppDbContext _db;
        public DeleteConditionHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(DeleteConditionCommand request, CancellationToken ct = default)
        {
            var condition = await _db.ExerciseConditions
                .Include(c => c.TaskTrainingBase)
                .FirstOrDefaultAsync(c => c.Id == request.ConditionId, ct);

            if (condition is null)
                throw new Domain.DomainException("Condiciones", $"Condición no encontrada: {request.ConditionId}", Domain.ErrorCodes.ExerciseConditionNotFound);

            var hasAccess = await _db.UserClubs
                .AnyAsync(uc => uc.ApplicationUserId == request.UserId && uc.ClubId == condition.TaskTrainingBase.ClubId, ct);

            if (!hasAccess)
                throw new Domain.DomainException("Condiciones", "No tienes acceso a esta condición.", Domain.ErrorCodes.ExerciseConditionAccessDenied);

            _db.ExerciseConditions.Remove(condition);
            await _db.SaveChangesAsync(ct);

            return Unit.Value;
        }
    }
}
