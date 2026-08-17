using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
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
                .Where(tb => tb.ClubId == request.ClubId);

            if (!string.IsNullOrEmpty(request.Methodology))
                query = query.Where(tb => tb.Methodology == request.Methodology);

            if (!string.IsNullOrEmpty(request.MicrocicloId))
                query = query.Where(tb => tb.MicrocicloId == request.MicrocicloId);

            var entities = await query
                .OrderBy(tb => tb.Name)
                .ToListAsync(ct);

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
                tb.MicrocicloId
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
        string? MicrocicloId = null);
}
