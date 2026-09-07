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

            var targetIds = request.TargetSubSubPrincipioIds ?? new List<string>();
            if (targetIds.Count > 0)
                await EnsureTargetsBelongToTeam(_db, targetIds, request.TeamId, ct);

            // Npgsql requires DateTimeKind.Utc for "timestamp with time zone" columns;
            // System.Text.Json deserializes offset-less dates as Unspecified. Same pattern
            // as CreateSportEvent.
            var dateUtc = request.Date.HasValue
                ? DateTime.SpecifyKind(request.Date.Value, DateTimeKind.Utc)
                : (DateTime?)null;

            var microcicloId = request.MicrocicloId;
            if (microcicloId is not null)
                await EnsureMicrocicloBelongsToTeam(_db, microcicloId, request.TeamId, ct);
            else if (dateUtc is not null)
                microcicloId = await ResolveMicrocicloIdByDate(_db, dateUtc.Value, request.TeamId, ct);

            var session = new TrainingSession
            {
                Name = request.Name.Trim(),
                Description = request.Description ?? string.Empty,
                Date = dateUtc,
                StartTime = request.StartTime,
                EndTime = request.EndTime,
                Location = request.Location ?? string.Empty,
                TeamId = request.TeamId,
                SportEventId = request.SportEventId,
                MicrocicloId = microcicloId,
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

            session.ReplaceTargets(targetIds);

            await _db.TrainingSessions.AddAsync(session, ct);
            await _db.SaveChangesAsync(ct);
            return session.Id;
        }

        /// <summary>Resolves the Microciclo whose date range contains <paramref name="date"/>
        /// for the given team, or null if no SeasonPlan/Microciclo covers it — design.md
        /// Decision 6. Never blocks scheduling a session on planning being incomplete.</summary>
        internal static async Task<string?> ResolveMicrocicloIdByDate(AppDbContext db, DateTime date, string teamId, CancellationToken ct)
        {
            var dateOnly = DateOnly.FromDateTime(date);
            return await db.Microciclos
                .Where(m => m.StartDate <= dateOnly && m.EndDate >= dateOnly)
                .Join(db.Mesociclos, m => m.MesocicloId, mes => mes.Id, (m, mes) => new { m, mes })
                .Join(db.Macrociclos, x => x.mes.MacrocicloId, mac => mac.Id, (x, mac) => new { x.m, mac })
                .Join(db.SeasonPlans, x => x.mac.SeasonPlanId, sp => sp.Id, (x, sp) => new { x.m, sp })
                .Where(x => x.sp.TeamId == teamId)
                .Select(x => x.m.Id)
                .FirstOrDefaultAsync(ct);
        }

        /// <summary>Validates every target SubSubPrincipio id belongs to the team's GameModel —
        /// same team-ownership guard as <see cref="EnsureMicrocicloBelongsToTeam"/>, design.md
        /// Decision 3. Walks SubSubPrincipio → (Subprincipio direct | Zona → Subprincipio) →
        /// GamePrincipio → GameModel.TeamId.</summary>
        internal static async Task EnsureTargetsBelongToTeam(AppDbContext db, IEnumerable<string> subSubPrincipioIds, string teamId, CancellationToken ct)
        {
            var ids = subSubPrincipioIds.Distinct().ToList();

            var validCount = await db.SubSubPrincipios
                .Where(ssp => ids.Contains(ssp.Id))
                .Where(ssp =>
                    (ssp.SubprincipioId != null && ssp.Subprincipio!.GamePrinciple.GameModel.TeamId == teamId) ||
                    (ssp.ZonaId != null && ssp.Zona!.Subprincipio.GamePrinciple.GameModel.TeamId == teamId))
                .CountAsync(ct);

            if (validCount != ids.Count)
                throw new DomainException("Sesiones",
                    "Uno o más objetivos no pertenecen al modelo de juego de este equipo.", ErrorCodes.TargetNotFound);
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

            // A session may be saved with no blocks at all, scheduled or not — content-first
            // authoring is not required to be calendar-ready. Product decision 2026-09-07:
            // removed the "at least one block when Date is set" requirement.
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
        }
    }
}
