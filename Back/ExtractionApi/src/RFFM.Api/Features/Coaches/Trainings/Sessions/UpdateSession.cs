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

namespace RFFM.Api.Features.Coaches.Trainings.Sessions
{
    /// <summary>
    /// Updates an existing training session.
    /// PUT /api/trainings/sessions/{id}
    /// </summary>
    public class UpdateSession : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/trainings/sessions/{id}",
                    async (string id, [FromBody] UpdateSessionBody body, HttpContext httpContext, IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        var command = new UpdateSessionCommand(
                            id, body.Name, body.Description, body.Date,
                            body.StartTime, body.EndTime, body.Location,
                            body.SportEventId, body.Exercises, userId);

                        await mediator.Send(command, ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(UpdateSession))
                .WithTags(TrainingConstants.SessionsTag)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }
    }

    public record UpdateSessionBody(
        string Name,
        string Description,
        DateTime Date,
        TimeSpan StartTime,
        TimeSpan? EndTime,
        string? Location,
        string? SportEventId,
        List<SessionExerciseInput> Exercises
    );

    public record UpdateSessionCommand(
        string Id,
        string Name,
        string Description,
        DateTime Date,
        TimeSpan StartTime,
        TimeSpan? EndTime,
        string? Location,
        string? SportEventId,
        List<SessionExerciseInput> Exercises,
        string UserId
    ) : IRequest;

    public class UpdateSessionHandler : IRequestHandler<UpdateSessionCommand>
    {
        private readonly AppDbContext _db;
        public UpdateSessionHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(UpdateSessionCommand request, CancellationToken ct = default)
        {
            var session = await _db.TrainingSessions
                .Include(s => s.Tasks)
                .Include(s => s.Team)
                .FirstOrDefaultAsync(s => s.Id == request.Id, ct);

            if (session is null)
                throw new DomainException("Sesiones", "Sesión no encontrada.", request.Id);

            var hasAccess = await _db.UserClubs
                .AnyAsync(uc => uc.ApplicationUserId == request.UserId && uc.ClubId == session.Team.ClubId, ct);

            if (!hasAccess)
                throw new DomainException("Sesiones", "No tienes acceso a esta sesión.", request.Id);

            session.Name = request.Name.Trim();
            session.Description = request.Description;
            session.Date = request.Date;
            session.StartTime = request.StartTime;
            session.EndTime = request.EndTime;
            session.Location = request.Location ?? string.Empty;
            session.SportEventId = request.SportEventId;

            // Replace exercise list
            _db.TasksTraining.RemoveRange(session.Tasks);
            session.Tasks.Clear();

            for (var i = 0; i < request.Exercises.Count; i++)
            {
                session.Tasks.Add(new TaskTraining
                {
                    Order = i + 1,
                    Section = request.Exercises[i].Section,
                    TaskTrainingBaseId = request.Exercises[i].ExerciseId,
                    SessionTrainingId = session.Id,
                });
            }

            await _db.SaveChangesAsync(ct);
            return Unit.Value;
        }
    }

    public class UpdateSessionValidator : AbstractValidator<UpdateSessionCommand>
    {
        public UpdateSessionValidator()
        {
            RuleFor(x => x.Id).NotEmpty();
            RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        }
    }
}
