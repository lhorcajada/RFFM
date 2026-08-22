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
    /// Updates an existing exercise.
    /// PUT /api/trainings/exercises/{id}
    /// </summary>
    public class UpdateExercise : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/trainings/exercises/{id}",
                    async (string id, UpdateExerciseCommand command, HttpContext httpContext, IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        await mediator.Send(command with { Id = id, UserId = userId }, ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(UpdateExercise))
                .WithTags(TrainingConstants.ExercisesTag)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status404NotFound)
                .Produces(StatusCodes.Status401Unauthorized);
        }
    }

    public record UpdateExerciseCommand(
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
    ) : IRequest, IRequireFeaturePermission
    {
        public string Id { get; init; } = string.Empty;
        public string UserId { get; init; } = string.Empty;

        public string FeatureRoute => CoachFeatureRoutes.Trainings;
        public string RequiredPermission => "ReadWrite";
    }

    public class UpdateExerciseHandler : IRequestHandler<UpdateExerciseCommand, Unit>
    {
        private readonly AppDbContext _db;
        public UpdateExerciseHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(UpdateExerciseCommand request, CancellationToken ct = default)
        {
            var exercise = await _db.TaskTrainingBases
                .Include(tb => tb.ModelRelations)
                    .ThenInclude(r => r.Items)
                .AsSplitQuery()
                .FirstOrDefaultAsync(tb => tb.Id == request.Id, ct);

            if (exercise is null)
                throw new DomainException("Ejercicios", "Ejercicio no encontrado.", ErrorCodes.ExerciseNotFound);

            var hasAccess = await _db.UserClubs
                .AnyAsync(uc => uc.ApplicationUserId == request.UserId && uc.ClubId == exercise.ClubId, ct);
            if (!hasAccess)
                throw new DomainException("Ejercicios", "No tienes acceso a este ejercicio.", ErrorCodes.ExerciseAccessDenied);

            exercise.Name = request.Name.Trim();
            exercise.Tipo = request.Tipo;
            exercise.Objetivo = request.Objetivo;
            exercise.ObjetivoPorRol = request.ObjetivoPorRol;
            exercise.Logistica = request.Logistica;
            exercise.DurationMinutes = request.DurationMinutes;
            exercise.Porteros = request.Porteros;
            exercise.Dibujo = request.Dibujo;
            exercise.Descripcion = request.Descripcion;
            if (request.BoardStateJson is not null)
                exercise.BoardStateJson = request.BoardStateJson;

            exercise.UpdateNiveles(
                request.NivelesColumnas,
                request.Niveles.Select(n => new ExerciseLevelRow(n.Nivel, n.Valores)));

            _db.RemoveRange(exercise.ModelRelations.SelectMany(r => r.Items));
            _db.RemoveRange(exercise.ModelRelations);
            exercise.ReplaceModelRelations(CreateExerciseHandler.BuildModelRelations(request.ModelRelations));

            await _db.SaveChangesAsync(ct);
            return Unit.Value;
        }
    }

    public class UpdateExerciseValidator : AbstractValidator<UpdateExerciseCommand>
    {
        public UpdateExerciseValidator()
        {
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
}
