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
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Trainings.Sessions
{
    /// <summary>
    /// Updates an existing training session, replacing its blocks wholesale.
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
                            id, body.Name, body.Description, body.Date, body.StartTime, body.EndTime,
                            body.Location, body.SportEventId, body.MicrocicloId, body.ObjetivoGeneral,
                            body.MapaCampoTexto, body.Blocks, userId, body.TargetSubSubPrincipioIds);

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
        string? Description,
        DateTime? Date,
        TimeSpan? StartTime,
        TimeSpan? EndTime,
        string? Location,
        string? SportEventId,
        string? MicrocicloId,
        string? ObjetivoGeneral,
        string? MapaCampoTexto,
        List<SessionBlockRequest> Blocks,
        List<string>? TargetSubSubPrincipioIds = null
    );

    public record UpdateSessionCommand(
        string Id,
        string Name,
        string? Description,
        DateTime? Date,
        TimeSpan? StartTime,
        TimeSpan? EndTime,
        string? Location,
        string? SportEventId,
        string? MicrocicloId,
        string? ObjetivoGeneral,
        string? MapaCampoTexto,
        List<SessionBlockRequest> Blocks,
        string UserId,
        List<string>? TargetSubSubPrincipioIds = null
    ) : IRequest, IRequireFeaturePermission
    {
        public string FeatureRoute => CoachFeatureRoutes.Trainings;
        public string RequiredPermission => "ReadWrite";
    }

    public class UpdateSessionHandler : IRequestHandler<UpdateSessionCommand>
    {
        private readonly AppDbContext _db;
        public UpdateSessionHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(UpdateSessionCommand request, CancellationToken ct = default)
        {
            var session = await _db.TrainingSessions
                .Include(s => s.Blocks)
                    .ThenInclude(b => b.Exercises)
                .Include(s => s.Targets)
                .Include(s => s.Team)
                .AsSplitQuery()
                .FirstOrDefaultAsync(s => s.Id == request.Id, ct);

            if (session is null)
                throw new DomainException("Sesiones", $"Sesión no encontrada: {request.Id}", ErrorCodes.SessionNotFound);

            var hasAccess = await _db.UserClubs
                .AnyAsync(uc => uc.ApplicationUserId == request.UserId && uc.ClubId == session.Team.ClubId, ct);

            if (!hasAccess)
                throw new DomainException("Sesiones", "No tienes acceso a esta sesión.", ErrorCodes.SessionAccessDenied);

            var targetIds = request.TargetSubSubPrincipioIds ?? new List<string>();
            if (targetIds.Count > 0)
                await CreateSessionHandler.EnsureTargetsBelongToTeam(_db, targetIds, session.TeamId, ct);

            // Npgsql requires DateTimeKind.Utc for "timestamp with time zone" columns;
            // System.Text.Json deserializes offset-less dates as Unspecified. Same pattern
            // as CreateSportEvent.
            var dateUtc = request.Date.HasValue
                ? DateTime.SpecifyKind(request.Date.Value, DateTimeKind.Utc)
                : (DateTime?)null;

            var microcicloId = request.MicrocicloId;
            if (microcicloId is not null)
                await CreateSessionHandler.EnsureMicrocicloBelongsToTeam(_db, microcicloId, session.TeamId, ct);
            else if (dateUtc is not null)
                microcicloId = await CreateSessionHandler.ResolveMicrocicloIdByDate(_db, dateUtc.Value, session.TeamId, ct);

            session.Name = request.Name.Trim();
            session.Description = request.Description ?? string.Empty;
            session.Date = dateUtc;
            session.StartTime = request.StartTime;
            session.EndTime = request.EndTime;
            session.Location = request.Location ?? string.Empty;
            session.SportEventId = request.SportEventId;
            session.MicrocicloId = microcicloId;
            session.ObjetivoGeneral = request.ObjetivoGeneral;
            session.MapaCampoTexto = request.MapaCampoTexto;

            // Replace blocks wholesale — same "trust server-derived state" approach used
            // throughout this codebase (was ReplaceModelLinks/ReplaceSubprincipioLinks).
            _db.RemoveRange(session.Blocks.SelectMany(b => b.Exercises));
            _db.RemoveRange(session.Blocks);
            session.Blocks.Clear();

            foreach (var blockRequest in request.Blocks.OrderBy(b => b.Order))
            {
                var block = new SessionBlock(session.Id, blockRequest.Order, blockRequest.Nombre,
                    blockRequest.ComoConectaConAnterior, blockRequest.RotacionEntreEjercicios);
                block.ReplaceExercises(blockRequest.Exercises.Select(e => (e.ExerciseId, e.Position)));
                session.Blocks.Add(block);
            }

            // Replace targets wholesale — same contract as Blocks (design.md Decision 3:
            // adding/removing a target is a full PUT with the session's complete target list).
            _db.RemoveRange(session.Targets);
            session.Targets.Clear();
            session.ReplaceTargets(targetIds);

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

            // See CreateSessionValidator — same conditional rule (design.md Decision 3.1).
            When(x => x.Date is not null, () =>
            {
                RuleFor(x => x.Blocks).NotEmpty()
                    .WithMessage("Una sesión debe tener al menos un bloque.");
            });
            RuleForEach(x => x.Blocks).SetValidator(new SessionBlockRequestValidator());
        }
    }
}
