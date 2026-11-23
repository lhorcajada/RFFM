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
    /// <param name="Subtipo">Optional, one of <see cref="TaskTrainingBase.SubtipoValues"/>.</param>
    public record CreateExerciseCommand(
        string ClubId,
        string Name,
        string Tipo,
        string Objetivo,
        string? ObjetivoPorRol,
        string Logistica,
        int? DurationMinutes,
        string? Dibujo,
        string Descripcion,
        List<string> NivelesColumnas,
        List<NivelRowRequest> Niveles,
        string? BoardStateJson,
        string? Subtipo = null
    ) : IRequest<string>, IRequireFeaturePermission, IExerciseSheetFields
    {
        public string UserId { get; init; } = string.Empty;

        public string? Espacio { get; init; }
        public int? TurnoMinutos { get; init; }
        public int? NivelDibujo { get; init; }
        public List<string> Reglas { get; init; } = new();
        public List<string> Puntos { get; init; } = new();
        public List<string> Rotaciones { get; init; } = new();
        public List<string> Montaje { get; init; } = new();

        public string FeatureRoute => CoachFeatureRoutes.Trainings;
        public string RequiredPermission => "ReadWrite";
    }

    /// <summary>One row of the "Niveles" table.</summary>
    public record NivelRowRequest(int Nivel, Dictionary<string, string> Valores);

    /// <summary>The structured sheet fields shared by the create and update commands.</summary>
    public interface IExerciseSheetFields
    {
        string? Espacio { get; }
        int? TurnoMinutos { get; }
        int? NivelDibujo { get; }
        List<string> Reglas { get; }
        List<string> Puntos { get; }
        List<string> Rotaciones { get; }
        List<string> Montaje { get; }
        List<NivelRowRequest> Niveles { get; }
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
                Tipo = request.Tipo,
                Subtipo = request.Subtipo,
                Objetivo = request.Objetivo,
                ObjetivoPorRol = request.ObjetivoPorRol,
                Logistica = request.Logistica,
                DurationMinutes = request.DurationMinutes,
                Dibujo = request.Dibujo,
                Descripcion = request.Descripcion,
                ClubId = request.ClubId,
                BoardStateJson = request.BoardStateJson,
            };

            ExerciseSheetMapper.Apply(exercise, request);

            exercise.UpdateNiveles(
                request.NivelesColumnas,
                request.Niveles.Select(n => new ExerciseLevelRow(n.Nivel, n.Valores)));

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
            RuleFor(x => x.Tipo).Must(t => TaskTrainingBase.TipoValues.Contains(t))
                .WithMessage("Tipo must be one of: Analitico, Situacional, Global.");
            RuleFor(x => x.Subtipo).Must(ExerciseSubtipoRule.IsValid)
                .WithMessage(ExerciseSubtipoRule.Message);
            RuleFor(x => x.Objetivo).NotEmpty();
            RuleFor(x => x.Niveles).Must(n => n.Count is >= 2 and <= 5)
                .WithMessage("Niveles must have between 2 and 5 rows.");
            Include(new ExerciseSheetFieldsValidator());
        }
    }

    /// <summary>Finite caps on the structured sheet fields. They are a safety net only: whether the
    /// content fits one printed sheet is measured by the client, never decided here.</summary>
    public static class ExerciseSheetLimits
    {
        public const int MaxLines = 30;
        public const int MaxLineLength = 1000;
        public const int MaxEspacioLength = ValidationConstants.TaskTrainingBaseSpaceMaxLength;
        public const int MaxTurnoMinutos = 240;
    }

    /// <summary>Shared by <see cref="CreateExerciseValidator"/> and <c>UpdateExerciseValidator</c>.</summary>
    public class ExerciseSheetFieldsValidator : AbstractValidator<IExerciseSheetFields>
    {
        public ExerciseSheetFieldsValidator()
        {
            RuleFor(x => x.Espacio).MaximumLength(ExerciseSheetLimits.MaxEspacioLength);
            RuleFor(x => x.TurnoMinutos).InclusiveBetween(1, ExerciseSheetLimits.MaxTurnoMinutos)
                .When(x => x.TurnoMinutos.HasValue);
            RuleFor(x => x.NivelDibujo)
                .Must((fields, nivel) => nivel is >= 1 && nivel <= fields.Niveles.Count)
                .When(x => x.NivelDibujo.HasValue)
                .WithMessage("NivelDibujo must be one of the Niveles rows.");

            RuleFor(x => x.Reglas).SetValidator(new ExerciseLinesValidator());
            RuleFor(x => x.Puntos).SetValidator(new ExerciseLinesValidator());
            RuleFor(x => x.Rotaciones).SetValidator(new ExerciseLinesValidator());
            RuleFor(x => x.Montaje).SetValidator(new ExerciseLinesValidator());
        }
    }

    public class ExerciseLinesValidator : AbstractValidator<List<string>>
    {
        public ExerciseLinesValidator()
        {
            RuleFor(x => x.Count).LessThanOrEqualTo(ExerciseSheetLimits.MaxLines)
                .WithMessage($"A list must have at most {ExerciseSheetLimits.MaxLines} lines.");
            RuleForEach(x => x).MaximumLength(ExerciseSheetLimits.MaxLineLength);
        }
    }

    internal static class ExerciseSheetMapper
    {
        /// <summary>Copies the structured sheet fields of a command onto the exercise.</summary>
        public static void Apply(TaskTrainingBase exercise, IExerciseSheetFields fields)
        {
            exercise.Espacio = fields.Espacio;
            exercise.TurnoMinutos = fields.TurnoMinutos;
            exercise.NivelDibujo = fields.NivelDibujo;
            exercise.Reglas = fields.Reglas?.ToList() ?? new();
            exercise.Puntos = fields.Puntos?.ToList() ?? new();
            exercise.Rotaciones = fields.Rotaciones?.ToList() ?? new();
            exercise.Montaje = fields.Montaje?.ToList() ?? new();
        }
    }

    /// <summary>Shared by <see cref="CreateExerciseValidator"/> and <c>UpdateExerciseValidator</c>.</summary>
    internal static class ExerciseSubtipoRule
    {
        public static bool IsValid(string? subtipo) =>
            subtipo is null || TaskTrainingBase.SubtipoValues.Contains(subtipo);

        public static readonly string Message =
            $"Subtipo must be empty or one of: {string.Join(", ", TaskTrainingBase.SubtipoValues)}.";
    }
}
