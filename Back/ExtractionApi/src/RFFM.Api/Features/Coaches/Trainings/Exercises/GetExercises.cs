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
                    async (string clubId, string? tipo, HttpContext httpContext, IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        var result = await mediator.Send(new GetExercisesQuery(clubId, tipo, userId), ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetExercises))
                .WithTags(TrainingConstants.ExercisesTag)
                .RequireAuthorization()
                .Produces<IEnumerable<ExerciseListItem>>();
        }
    }

    public record GetExercisesQuery(string ClubId, string? Tipo, string UserId) : IRequest<IEnumerable<ExerciseListItem>>, IRequireFeaturePermission
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
                .Include(tb => tb.ModelRelations)
                    .ThenInclude(r => r.Items)
                .AsSplitQuery()
                .Where(tb => tb.ClubId == request.ClubId);

            if (!string.IsNullOrEmpty(request.Tipo))
                query = query.Where(tb => tb.Tipo == request.Tipo);

            var entities = await query
                .OrderBy(tb => tb.Name)
                .ToListAsync(ct);

            var relationSummaries = await ExerciseModelRelationResolver.ResolveAsync(_db, entities.SelectMany(e => e.ModelRelations), ct);

            return entities.Select(tb => ExerciseListItem.From(tb, relationSummaries));
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
        IEnumerable<ExerciseModelRelationDto> ModelRelations,
        bool IsAssociatedToGameModel)
    {
        public static ExerciseListItem From(TaskTrainingBase tb, IReadOnlyDictionary<string, ExerciseModelRelationDto> relationSummaries) => new(
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
            tb.ModelRelations.Select(r => relationSummaries[r.Id]),
            tb.ModelRelations.Count > 0);
    }

    /// <summary>Denormalized display fields for an <see cref="ExerciseModelRelationItem"/>.</summary>
    public record ExerciseModelRelationItemDto(string Id, string SubSubPrincipioId, string? SubSubPrincipioNumero, string? SubSubPrincipioRol, bool IsFoco);

    /// <summary>Denormalized display fields for an <see cref="ExerciseModelRelation"/>, joining
    /// Subprincipio for Numero/Titulo (design.md §1.2).</summary>
    public record ExerciseModelRelationDto(
        string Id,
        string SubprincipioId,
        string? SubprincipioNumero,
        string? SubprincipioTitulo,
        bool IsFoco,
        IEnumerable<string> HabilidadesImprescindibles,
        IEnumerable<ExerciseModelRelationItemDto> Items);

    /// <summary>Batch-resolves <see cref="ExerciseModelRelation"/> rows (and their items) to
    /// their denormalized display fields, shared by GetExercises/GetExerciseById.</summary>
    internal static class ExerciseModelRelationResolver
    {
        public static async Task<Dictionary<string, ExerciseModelRelationDto>> ResolveAsync(
            AppDbContext db, IEnumerable<ExerciseModelRelation> relations, CancellationToken ct)
        {
            var relationList = relations.ToList();

            var subprincipioIds = relationList.Select(r => r.SubprincipioId).Distinct().ToList();
            var subSubPrincipioIds = relationList.SelectMany(r => r.Items).Select(i => i.SubSubPrincipioId).Distinct().ToList();

            var subprincipios = await db.Subprincipios
                .AsNoTracking()
                .Where(s => subprincipioIds.Contains(s.Id))
                .ToDictionaryAsync(s => s.Id, ct);

            var subSubPrincipios = await db.SubSubPrincipios
                .AsNoTracking()
                .Where(s => subSubPrincipioIds.Contains(s.Id))
                .ToDictionaryAsync(s => s.Id, ct);

            return relationList.ToDictionary(r => r.Id, r =>
            {
                var subprincipio = subprincipios.GetValueOrDefault(r.SubprincipioId);

                return new ExerciseModelRelationDto(
                    r.Id, r.SubprincipioId, subprincipio?.Numero, subprincipio?.Titulo, r.IsFoco,
                    r.HabilidadesImprescindibles,
                    r.Items.Select(i =>
                    {
                        var subSubPrincipio = subSubPrincipios.GetValueOrDefault(i.SubSubPrincipioId);
                        return new ExerciseModelRelationItemDto(i.Id, i.SubSubPrincipioId, subSubPrincipio?.Numero, subSubPrincipio?.Rol, i.IsFoco);
                    }));
            });
        }
    }
}
