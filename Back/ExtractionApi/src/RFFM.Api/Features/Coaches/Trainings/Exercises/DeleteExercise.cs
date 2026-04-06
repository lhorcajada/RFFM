using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Trainings.Exercises
{
    /// <summary>
    /// Deletes an exercise from the library.
    /// DELETE /api/trainings/exercises/{id}
    /// </summary>
    public class DeleteExercise : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/api/trainings/exercises/{id}",
                    async (string id, HttpContext httpContext, IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        await mediator.Send(new DeleteExerciseCommand(id, userId), ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteExercise))
                .WithTags(TrainingConstants.ExercisesTag)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }
    }

    public record DeleteExerciseCommand(string Id, string UserId) : IRequest;

    public class DeleteExerciseHandler : IRequestHandler<DeleteExerciseCommand, Unit>
    {
        private readonly AppDbContext _db;
        public DeleteExerciseHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(DeleteExerciseCommand request, CancellationToken ct = default)
        {
            var exercise = await _db.TaskTrainingBases.FirstOrDefaultAsync(tb => tb.Id == request.Id, ct);
            if (exercise is null)
                throw new DomainException("Ejercicios", "Ejercicio no encontrado.", "");

            var hasAccess = await _db.UserClubs
                .AnyAsync(uc => uc.ApplicationUserId == request.UserId && uc.ClubId == exercise.ClubId, ct);
            if (!hasAccess)
                throw new DomainException("Ejercicios", "No tienes acceso a este ejercicio.", "");

            _db.TaskTrainingBases.Remove(exercise);
            await _db.SaveChangesAsync(ct);
            return Unit.Value;
        }
    }
}
