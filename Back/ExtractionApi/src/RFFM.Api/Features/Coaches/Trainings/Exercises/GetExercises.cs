using FluentValidation;
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
    /// GET /api/trainings/exercises?clubId=&amp;methodology=
    /// </summary>
    public class GetExercises : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/trainings/exercises",
                    async (string clubId, string? methodology, string? microcicloId, HttpContext httpContext, IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        var result = await mediator.Send(new GetExercisesQuery(clubId, methodology, userId, microcicloId), ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetExercises))
                .WithTags(TrainingConstants.ExercisesTag)
                .RequireAuthorization()
                .Produces<IEnumerable<ExerciseListItem>>();
        }
    }

    public record GetExercisesQuery(string ClubId, string? Methodology, string UserId, string? MicrocicloId = null) : IRequest<IEnumerable<ExerciseListItem>>, IRequireFeaturePermission
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
                .Include(tb => tb.Types)
                    .ThenInclude(t => t.ExerciseType)
                .Include(tb => tb.Conditions)
                .Include(tb => tb.ModelLinks)
                .AsSplitQuery()
                .Where(tb => tb.ClubId == request.ClubId);

            if (!string.IsNullOrEmpty(request.Methodology))
                query = query.Where(tb => tb.Methodology == request.Methodology);

            if (!string.IsNullOrEmpty(request.MicrocicloId))
                query = query.Where(tb => tb.MicrocicloId == request.MicrocicloId);

            var entities = await query
                .OrderBy(tb => tb.Name)
                .ToListAsync(ct);

            var modelLinkSummaries = await ExerciseModelLinkResolver.ResolveAsync(_db, entities.SelectMany(e => e.ModelLinks), ct);

            return entities.Select(tb => new ExerciseListItem(
                tb.Id,
                tb.Name,
                tb.Description,
                tb.Types.Select(t => t.ExerciseType.Name),
                tb.Section,
                tb.Methodology,
                tb.DurationTotal,
                tb.PlayersNumber,
                tb.GoalPeekersNumber,
                tb.FieldSpace,
                tb.UrlImage,
                tb.BoardStateJson,
                tb.Conditions.OrderBy(c => c.Order).Select(c => new ConditionDto(c.Id, c.Text, c.Order)),
                tb.MicrocicloId,
                tb.ModelLinks.Select(l => modelLinkSummaries[l.Id]),
                tb.Habilidades
            ));
        }
    }

    public record ExerciseListItem(
        string Id,
        string Name,
        string Description,
        IEnumerable<string> Types,
        string Section,
        string Methodology,
        int DurationTotal,
        int PlayersNumber,
        int GoalPeekersNumber,
        string FieldSpace,
        string? UrlImage,
        string? BoardStateJson,
        IEnumerable<ConditionDto> Conditions,
        string? MicrocicloId = null,
        IEnumerable<ExerciseModelLinkDto>? ModelLinks = null,
        IEnumerable<string>? Habilidades = null)
    {
        public IEnumerable<ExerciseModelLinkDto> ModelLinks { get; init; } = ModelLinks ?? Enumerable.Empty<ExerciseModelLinkDto>();
        public IEnumerable<string> Habilidades { get; init; } = Habilidades ?? Enumerable.Empty<string>();
    }

    /// <summary>Denormalized display fields for an <see cref="RFFM.Api.Domain.Aggregates.Training.TasksTraining.ExerciseModelLink"/>,
    /// joining <c>Subprincipio</c>/<c>SubSubPrincipio</c> for <c>Numero</c>+<c>Titulo</c>/<c>Rol</c> (design.md Amendment 2).</summary>
    public record ExerciseModelLinkDto(
        string Id,
        string? SubprincipioId,
        string? SubprincipioNumero,
        string? SubprincipioTitulo,
        string? SubSubPrincipioId,
        string? SubSubPrincipioNumero,
        string? SubSubPrincipioRol,
        bool IsFoco);

    /// <summary>Batch-resolves <see cref="ExerciseModelLink"/> rows to their denormalized
    /// <see cref="ExerciseModelLinkDto"/> display fields, shared by GetExercises/GetExerciseById.</summary>
    internal static class ExerciseModelLinkResolver
    {
        public static async Task<Dictionary<string, ExerciseModelLinkDto>> ResolveAsync(
            AppDbContext db, IEnumerable<ExerciseModelLink> links, CancellationToken ct)
        {
            var linkList = links.ToList();

            var subprincipioIds = linkList.Where(l => l.SubprincipioId != null).Select(l => l.SubprincipioId!).Distinct().ToList();
            var subSubPrincipioIds = linkList.Where(l => l.SubSubPrincipioId != null).Select(l => l.SubSubPrincipioId!).Distinct().ToList();

            var subprincipios = await db.Subprincipios
                .AsNoTracking()
                .Where(s => subprincipioIds.Contains(s.Id))
                .ToDictionaryAsync(s => s.Id, ct);

            var subSubPrincipios = await db.SubSubPrincipios
                .AsNoTracking()
                .Where(s => subSubPrincipioIds.Contains(s.Id))
                .ToDictionaryAsync(s => s.Id, ct);

            return linkList.ToDictionary(l => l.Id, l =>
            {
                var subprincipio = l.SubprincipioId is not null ? subprincipios.GetValueOrDefault(l.SubprincipioId) : null;
                var subSubPrincipio = l.SubSubPrincipioId is not null ? subSubPrincipios.GetValueOrDefault(l.SubSubPrincipioId) : null;

                return new ExerciseModelLinkDto(
                    l.Id,
                    subprincipio?.Id, subprincipio?.Numero, subprincipio?.Titulo,
                    subSubPrincipio?.Id, subSubPrincipio?.Numero, subSubPrincipio?.Rol,
                    l.IsFoco);
            });
        }
    }
}
