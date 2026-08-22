using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Trainings.Exercises
{
    /// <summary>
    /// Creates a new exercise in the club library, following the reduced content template
    /// (docs/game-model/Plantilla-Ejercicio.md).
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

    /// <param name="Tipo">Analitico | Situacional | Global.</param>
    public record CreateExerciseCommand(
        string ClubId,
        string Name,
        string Tipo,
        string Objetivo,
        string? ObjetivoPorRol,
        string Logistica,
        int? DurationMinutes,
        string? Porteros,
        string? Dibujo,
        string Descripcion,
        List<string> NivelesColumnas,
        List<NivelRowRequest> Niveles,
        string? BoardStateJson,
        List<ExerciseModelRelationRequest>? ModelRelations = null
    ) : IRequest<string>, IRequireFeaturePermission
    {
        public string UserId { get; init; } = string.Empty;

        public string FeatureRoute => CoachFeatureRoutes.Trainings;
        public string RequiredPermission => "ReadWrite";
    }

    /// <summary>One row of the "Niveles" table.</summary>
    public record NivelRowRequest(int Nivel, Dictionary<string, string> Valores);

    /// <summary>A single "Relación con el modelo de juego" row: the Fase/Principio/Subprincipio
    /// the exercise trains, tagged FOCO/INTEGRADO, with its own Habilidades imprescindibles and
    /// a repeatable list of SubSubPrincipio items.</summary>
    public record ExerciseModelRelationRequest(
        string SubprincipioId,
        bool IsFoco,
        List<string>? HabilidadesImprescindibles,
        List<ExerciseModelRelationItemRequest>? Items);

    public record ExerciseModelRelationItemRequest(string SubSubPrincipioId, bool IsFoco);

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
                Tipo = request.Tipo,
                Objetivo = request.Objetivo,
                ObjetivoPorRol = request.ObjetivoPorRol,
                Logistica = request.Logistica,
                DurationMinutes = request.DurationMinutes,
                Porteros = request.Porteros,
                Dibujo = request.Dibujo,
                Descripcion = request.Descripcion,
                ClubId = request.ClubId,
                BoardStateJson = request.BoardStateJson,
            };

            exercise.UpdateNiveles(
                request.NivelesColumnas,
                request.Niveles.Select(n => new ExerciseLevelRow(n.Nivel, n.Valores)));

            exercise.ReplaceModelRelations(BuildModelRelations(request.ModelRelations));

            await _db.TaskTrainingBases.AddAsync(exercise, ct);
            await _db.SaveChangesAsync(ct);
            return exercise.Id;
        }

        internal static IEnumerable<(string SubprincipioId, bool IsFoco, IEnumerable<string>? Habilidades,
            IEnumerable<(string SubSubPrincipioId, bool IsFoco)> Items)> BuildModelRelations(
            List<ExerciseModelRelationRequest>? relations) =>
            (relations ?? new List<ExerciseModelRelationRequest>())
                .Select(r => (
                    r.SubprincipioId,
                    r.IsFoco,
                    (IEnumerable<string>?)r.HabilidadesImprescindibles,
                    (IEnumerable<(string, bool)>)(r.Items ?? new List<ExerciseModelRelationItemRequest>())
                        .Select(i => (i.SubSubPrincipioId, i.IsFoco))));
    }

    // ── Validator ────────────────────────────────────────────────────────────────

    public class CreateExerciseValidator : AbstractValidator<CreateExerciseCommand>
    {
        public CreateExerciseValidator()
        {
            RuleFor(x => x.ClubId).NotEmpty();
            RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
            RuleFor(x => x.Tipo).Must(t => TaskTrainingBase.TipoValues.Contains(t))
                .WithMessage("Tipo must be one of: Analitico, Situacional, Global.");
            RuleFor(x => x.Objetivo).NotEmpty();
            RuleFor(x => x.Logistica).NotEmpty();
            RuleFor(x => x.Descripcion).NotEmpty();
            RuleFor(x => x.Niveles).Must(n => n.Count is >= 2 and <= 5)
                .WithMessage("Niveles must have between 2 and 5 rows.");
            RuleForEach(x => x.ModelRelations).SetValidator(new ExerciseModelRelationRequestValidator());
        }
    }

    /// <summary>Shared by <see cref="CreateExerciseValidator"/> and <c>UpdateExerciseValidator</c>.</summary>
    public class ExerciseModelRelationRequestValidator : AbstractValidator<ExerciseModelRelationRequest>
    {
        public ExerciseModelRelationRequestValidator()
        {
            RuleFor(x => x.SubprincipioId).NotEmpty()
                .WithMessage("A model relation requires a Subprincipio.");
            RuleForEach(x => x.HabilidadesImprescindibles)
                .Must(h => Habilidad.Vocabulary.Contains(h))
                .WithMessage("Habilidad must be one of the 15-value closed vocabulary.");
            RuleForEach(x => x.Items).SetValidator(new ExerciseModelRelationItemRequestValidator());
        }
    }

    public class ExerciseModelRelationItemRequestValidator : AbstractValidator<ExerciseModelRelationItemRequest>
    {
        public ExerciseModelRelationItemRequestValidator()
        {
            RuleFor(x => x.SubSubPrincipioId).NotEmpty();
        }
    }
}
