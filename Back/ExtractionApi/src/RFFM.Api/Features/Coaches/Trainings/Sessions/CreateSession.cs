using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.Training;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Trainings.Sessions
{
    /// <summary>
    /// Creates a new training session.
    /// POST /api/trainings/sessions
    /// </summary>
    public class CreateSession : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/trainings/sessions",
                    async (CreateSessionCommand command, HttpContext httpContext, IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        var id = await mediator.Send(command with { UserId = userId }, ct);
                        return Results.Created($"/api/trainings/sessions/{id}", new { id });
                    })
                .WithName(nameof(CreateSession))
                .WithTags(TrainingConstants.SessionsTag)
                .RequireAuthorization()
                .Produces(StatusCodes.Status201Created)
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }
    }

    /// <param name="Exercises">Ordered list of exercises with their session-section assignment.</param>
    public record SessionExerciseInput(string ExerciseId, string Section);

    public record CreateSessionCommand(
        string TeamId,
        string Name,
        string Description,
        DateTime Date,
        TimeSpan StartTime,
        TimeSpan? EndTime,
        string? Location,
        string? SportEventId,
        string? SubPrincipleId,
        List<SessionExerciseInput> Exercises
    ) : IRequest<string>, IRequireFeaturePermission
    {
        public string UserId { get; init; } = string.Empty;

        public string FeatureRoute => CoachFeatureRoutes.Trainings;
        public string RequiredPermission => "ReadWrite";
    }

    public class CreateSessionHandler : IRequestHandler<CreateSessionCommand, string>
    {
        private readonly AppDbContext _db;
        public CreateSessionHandler(AppDbContext db) => _db = db;

        public async ValueTask<string> Handle(CreateSessionCommand request, CancellationToken ct = default)
        {
            var hasAccess = await _db.UserClubs
                .Join(_db.Teams, uc => uc.ClubId, t => t.ClubId, (uc, t) => new { uc, t })
                .AnyAsync(x => x.uc.ApplicationUserId == request.UserId && x.t.Id == request.TeamId, ct);

            if (!hasAccess)
                throw new DomainException("Sesiones", "No tienes acceso a este equipo.", ErrorCodes.TeamAccessDenied);

            var session = new TrainingSession
            {
                Name = request.Name.Trim(),
                Description = request.Description,
                Date = request.Date,
                StartTime = request.StartTime,
                EndTime = request.EndTime,
                Location = request.Location ?? string.Empty,
                TeamId = request.TeamId,
                SportEventId = request.SportEventId,
                SubPrincipleId = request.SubPrincipleId,
            };

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

            await _db.TrainingSessions.AddAsync(session, ct);
            await _db.SaveChangesAsync(ct);
            return session.Id;
        }
    }

    public class CreateSessionValidator : AbstractValidator<CreateSessionCommand>
    {
        public CreateSessionValidator()
        {
            RuleFor(x => x.TeamId).NotEmpty();
            RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        }
    }
}
