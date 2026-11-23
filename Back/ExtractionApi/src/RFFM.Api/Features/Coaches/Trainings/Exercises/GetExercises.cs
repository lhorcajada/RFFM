using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
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
    /// Lists exercises for a club.
    /// GET /api/trainings/exercises?clubId=
    /// </summary>
    public class GetExercises : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/trainings/exercises",
                    async (string clubId, string? tipo, string? subtipo, HttpContext httpContext, IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        var result = await mediator.Send(new GetExercisesQuery(clubId, tipo, userId, subtipo), ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetExercises))
                .WithTags(TrainingConstants.ExercisesTag)
                .RequireAuthorization()
                .Produces<IEnumerable<ExerciseListItem>>();
        }
    }

    public record GetExercisesQuery(string ClubId, string? Tipo, string UserId, string? Subtipo = null) : IRequest<IEnumerable<ExerciseListItem>>, IRequireFeaturePermission
    {
        public string FeatureRoute => CoachFeatureRoutes.Trainings;
        public string RequiredPermission => "Read";
    }

    public class GetExercisesHandler : IRequestHandler<GetExercisesQuery, IEnumerable<ExerciseListItem>>
    {
        private readonly AppDbContext _db;
        public GetExercisesHandler(AppDbContext db) => _db = db;

        public async ValueTask<IEnumerable<ExerciseListItem>> Handle(GetExercisesQuery request, CancellationToken ct = default)
        {
            var hasAccess = await _db.UserClubs
                .AnyAsync(uc => uc.ApplicationUserId == request.UserId && uc.ClubId == request.ClubId, ct);

            if (!hasAccess)
                throw new DomainException("Ejercicios", "No tienes acceso a este club.", ErrorCodes.ClubAccessDenied);

            var query = _db.TaskTrainingBases
                .Where(tb => tb.ClubId == request.ClubId);

            if (!string.IsNullOrEmpty(request.Tipo))
                query = query.Where(tb => tb.Tipo == request.Tipo);

            if (!string.IsNullOrEmpty(request.Subtipo))
                query = query.Where(tb => tb.Subtipo == request.Subtipo);

            var entities = await query
                .OrderBy(tb => tb.Name)
                .ToListAsync(ct);

            return entities.Select(ExerciseListItem.From);
        }
    }

    public record NivelRowDto(int Nivel, Dictionary<string, string> Valores);

    public record ExerciseListItem(
        string Id,
        string Name,
        string Tipo,
        string Objetivo,
        string? ObjetivoPorRol,
        string Logistica,
        int? DurationMinutes,
        string? Porteros,
        string? Dibujo,
        string Descripcion,
        string? UrlImage,
        string? BoardStateJson,
        List<string> NivelesColumnas,
        IEnumerable<NivelRowDto> Niveles,
        string? Subtipo,
        string? Espacio,
        int? TurnoMinutos,
        int? NivelDibujo,
        List<string> Secuencia,
        List<string> Reglas,
        List<string> QueSeVe,
        List<ExerciseTeamDto> Jugadores)
    {
        public static ExerciseListItem From(TaskTrainingBase tb) => new(
            tb.Id,
            tb.Name,
            tb.Tipo,
            tb.Objetivo,
            tb.ObjetivoPorRol,
            tb.Logistica,
            tb.DurationMinutes,
            tb.Porteros,
            tb.Dibujo,
            tb.Descripcion,
            tb.UrlImage,
            tb.BoardStateJson,
            tb.NivelesColumnas,
            tb.Niveles.Select(n => new NivelRowDto(n.Nivel, n.Valores)),
            tb.Subtipo,
            tb.Espacio,
            tb.TurnoMinutos,
            tb.NivelDibujo,
            tb.Secuencia,
            tb.Reglas,
            tb.QueSeVe,
            tb.Jugadores.Select(t => new ExerciseTeamDto(t.Color, t.Nombre, t.Cantidad, t.Roles, t.Objetivos)).ToList());
    }

    public record ExerciseTeamDto(string? Color, string Nombre, int? Cantidad, string? Roles, List<string> Objetivos);
}
