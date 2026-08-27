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
    /// Creates a new training session as a sequence of blocks (docs/game-model/Plantilla-Sesion.md).
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

    // ── Request ──────────────────────────────────────────────────────────────────

    public record SessionBlockExerciseRequest(string ExerciseId, int Position);

    public record SessionBlockRequest(
        int Order,
        string Nombre,
        string ComoConectaConAnterior,
        string? RotacionEntreEjercicios,
        List<SessionBlockExerciseRequest> Exercises);

    public record CreateSessionCommand(
        string TeamId,
        string Name,
        string? Description,
        DateTime Date,
        TimeSpan StartTime,
        TimeSpan? EndTime,
        string? Location,
        string? SportEventId,
        string? MicrocicloId,
        string? ObjetivoGeneral,
        string? MapaCampoTexto,
        List<SessionBlockRequest> Blocks
    ) : IRequest<string>, IRequireFeaturePermission
    {
        public string UserId { get; init; } = string.Empty;

        public string FeatureRoute => CoachFeatureRoutes.Trainings;
        public string RequiredPermission => "ReadWrite";
    }

    // ── Handler ──────────────────────────────────────────────────────────────────

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

            if (request.MicrocicloId is not null)
                await EnsureMicrocicloBelongsToTeam(_db, request.MicrocicloId, request.TeamId, ct);

            var session = new TrainingSession
            {
                Name = request.Name.Trim(),
                Description = request.Description ?? string.Empty,
                Date = request.Date,
                StartTime = request.StartTime,
                EndTime = request.EndTime,
                Location = request.Location ?? string.Empty,
                TeamId = request.TeamId,
                SportEventId = request.SportEventId,
                MicrocicloId = request.MicrocicloId,
                ObjetivoGeneral = request.ObjetivoGeneral,
                MapaCampoTexto = request.MapaCampoTexto,
            };

            foreach (var blockRequest in request.Blocks.OrderBy(b => b.Order))
            {
                var block = new SessionBlock(session.Id, blockRequest.Order, blockRequest.Nombre,
                    blockRequest.ComoConectaConAnterior, blockRequest.RotacionEntreEjercicios);
                block.ReplaceExercises(blockRequest.Exercises.Select(e => (e.ExerciseId, e.Position)));
                session.Blocks.Add(block);
            }

            await _db.TrainingSessions.AddAsync(session, ct);
            await _db.SaveChangesAsync(ct);
            return session.Id;
        }

        /// <summary>Validates a Microciclo exists and belongs to a SeasonPlan for the same Team
        /// (join Microciclo -> Mesociclo -> Macrociclo -> SeasonPlan.TeamId), per
        /// design.md §4 / specs/sessions "Selecting a Microciclo from another team is rejected".</summary>
        internal static async Task EnsureMicrocicloBelongsToTeam(AppDbContext db, string microcicloId, string teamId, CancellationToken ct)
        {
            var planTeamId = await db.Microciclos
                .Where(m => m.Id == microcicloId)
                .Join(db.Mesociclos, m => m.MesocicloId, mes => mes.Id, (m, mes) => mes)
                .Join(db.Macrociclos, mes => mes.MacrocicloId, mac => mac.Id, (mes, mac) => mac)
                .Join(db.SeasonPlans, mac => mac.SeasonPlanId, sp => sp.Id, (mac, sp) => sp.TeamId)
                .FirstOrDefaultAsync(ct);

            if (planTeamId is null)
                throw new DomainException("Sesiones", "El microciclo indicado no existe.", ErrorCodes.MicrocicloNotFound);

            if (planTeamId != teamId)
                throw new DomainException("Sesiones",
                    "El microciclo indicado pertenece a la planificación de otro equipo.", ErrorCodes.MicrocicloTeamMismatch);
        }
    }

    // ── Validator ────────────────────────────────────────────────────────────────

    public class CreateSessionValidator : AbstractValidator<CreateSessionCommand>
    {
        public CreateSessionValidator()
        {
            RuleFor(x => x.TeamId).NotEmpty();
            RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
            RuleFor(x => x.Blocks).NotEmpty()
                .WithMessage("Una sesión debe tener al menos un bloque.");
            RuleForEach(x => x.Blocks).SetValidator(new SessionBlockRequestValidator());
        }
    }

    public class SessionBlockRequestValidator : AbstractValidator<SessionBlockRequest>
    {
        public SessionBlockRequestValidator()
        {
            RuleFor(x => x.Nombre).NotEmpty().MaximumLength(200);
            RuleFor(x => x.ComoConectaConAnterior).NotEmpty()
                .WithMessage("Todo bloque debe indicar cómo conecta con el anterior, incluso el primero.");
            RuleFor(x => x.Exercises).NotEmpty()
                .WithMessage("Un bloque debe tener al menos un ejercicio.");
        }
    }
}
