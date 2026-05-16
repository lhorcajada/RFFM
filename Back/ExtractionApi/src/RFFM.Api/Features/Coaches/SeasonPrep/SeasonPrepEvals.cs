using System.Security.Claims;
using System.Text.Json;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.Coaches;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.SeasonPrep
{
    internal static class SeasonPrepEvaluationsJson
    {
        public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
    }

    // ── GET /api/season-prep/evaluations?fedSeason=X&sportEventId=Y ───────────

    public class GetSeasonPrepEvaluations : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/season-prep/evaluations",
                    async (string fedSeason, string? sportEventId, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? throw new UnauthorizedAccessException("Usuario no autenticado");
                        var result = await mediator.Send(new GetSeasonPrepEvaluationsQuery(userId, fedSeason, sportEventId), cancellationToken);
                        return result.Count > 0 ? Results.Ok(result) : Results.NoContent();
                    })
                .WithName(nameof(GetSeasonPrepEvaluations))
                .WithTags("SeasonPrep")
                .Produces<List<SeasonPrepEvaluationPlayerDto>>(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status204NoContent)
                .RequireAuthorization();
        }
    }

    public record SeasonPrepRatingAnswerDto(
        string CharacteristicKey,
        string CategoryKey,
        int Level,
        string Concept);

    public record SeasonPrepRatingDto(
        string Id,
        string TeamPlayerId,
        bool IsGoalkeeper,
        decimal Physical,
        decimal Technical,
        decimal Tactical,
        decimal Competitiveness,
        IReadOnlyList<SeasonPrepRatingAnswerDto> Answers,
        DateTime RatedAt,
        string? Notes);

    public record SeasonPrepEvaluationPlayerDto(
        string UniqueId,
        string Name,
        string? Team,
        string? TeamCode,
        string? Position,
        int? BirthYear,
        string? Procedencia,
        bool? ManualEntry,
        SeasonPrepRatingDto? Rating,
        string? RecruitmentStatus,
        int? Starter,
        int? TotalGoals);

    public record GetSeasonPrepEvaluationsQuery(string UserId, string FedSeason, string? SportEventId) : IRequest<IReadOnlyList<SeasonPrepEvaluationPlayerDto>>;

    public class GetSeasonPrepEvaluationsHandler : IRequestHandler<GetSeasonPrepEvaluationsQuery, IReadOnlyList<SeasonPrepEvaluationPlayerDto>>
    {
        private readonly AppDbContext _db;

        public GetSeasonPrepEvaluationsHandler(AppDbContext db) => _db = db;

        public async ValueTask<IReadOnlyList<SeasonPrepEvaluationPlayerDto>> Handle(GetSeasonPrepEvaluationsQuery request, CancellationToken cancellationToken)
        {
            var stored = await _db.SeasonPrepEvaluations
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.UserId == request.UserId && s.FedSeason == request.FedSeason && s.SportEventId == request.SportEventId, cancellationToken);

            if (stored is null && request.SportEventId is not null)
            {
                stored = await _db.SeasonPrepEvaluations
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => s.UserId == request.UserId && s.FedSeason == request.FedSeason && s.SportEventId == null, cancellationToken);
            }

            if (stored is not null)
            {
                try
                {
                    var parsed = JsonSerializer.Deserialize<List<SeasonPrepEvaluationPlayerDto>>(stored.Data, SeasonPrepEvaluationsJson.Options);
                    if (parsed is { Count: > 0 })
                        return parsed;
                }
                catch
                {
                    // fall back to the normalized ratings table if the JSON blob is invalid
                }
            }

            var ratings = await _db.SeasonPrepPlayerRatings
                .AsNoTracking()
                .Include(r => r.Details)
                .Where(r => r.UserId == request.UserId && r.FedSeason == request.FedSeason && r.SportEventId == request.SportEventId)
                .OrderByDescending(r => r.RatedAt)
                .ToListAsync(cancellationToken);

            if (ratings.Count == 0 && request.SportEventId is not null)
            {
                ratings = await _db.SeasonPrepPlayerRatings
                    .AsNoTracking()
                    .Include(r => r.Details)
                    .Where(r => r.UserId == request.UserId && r.FedSeason == request.FedSeason && r.SportEventId == null)
                    .OrderByDescending(r => r.RatedAt)
                    .ToListAsync(cancellationToken);
            }

            return ratings.Select(r => new SeasonPrepEvaluationPlayerDto(
                r.SeasonPrepPlayerId,
                string.Empty,
                null,
                null,
                null,
                null,
                null,
                null,
                new SeasonPrepRatingDto(
                    r.Id,
                    r.SeasonPrepPlayerId,
                    r.IsGoalkeeper,
                    r.Physical,
                    r.Technical,
                    r.Tactical,
                    r.Competitiveness,
                    r.Details.Select(d => new SeasonPrepRatingAnswerDto(d.CharacteristicKey, d.CategoryKey, d.Level, d.Concept)).ToList(),
                    r.RatedAt,
                    r.Notes),
                null,
                null,
                null)).ToList();
        }
    }

    // ── PUT /api/season-prep/evaluations ─────────────────────────────────────

    public class UpsertSeasonPrepEvaluations : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("api/season-prep/evaluations",
                    async (UpsertSeasonPrepEvaluationsCommand command, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? throw new UnauthorizedAccessException("Usuario no autenticado");
                        await mediator.Send(command with { UserId = userId }, cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(UpsertSeasonPrepEvaluations))
                .WithTags("SeasonPrep")
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .RequireAuthorization();
        }
    }

    public record UpsertSeasonPrepEvaluationsCommand(string FedSeason, string? SportEventId, IReadOnlyList<SeasonPrepEvaluationPlayerDto> Players, string UserId = "") : IRequest;

    public class UpsertSeasonPrepEvaluationsHandler : IRequestHandler<UpsertSeasonPrepEvaluationsCommand>
    {
        private readonly AppDbContext _db;

        public UpsertSeasonPrepEvaluationsHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(UpsertSeasonPrepEvaluationsCommand request, CancellationToken cancellationToken)
        {
            var stored = await _db.SeasonPrepEvaluations
                .FirstOrDefaultAsync(s => s.UserId == request.UserId && s.FedSeason == request.FedSeason && s.SportEventId == request.SportEventId, cancellationToken);

            var serialized = JsonSerializer.Serialize(request.Players, SeasonPrepEvaluationsJson.Options);
            if (stored is null)
            {
                _db.SeasonPrepEvaluations.Add(new SeasonPrepEvaluations
                {
                    UserId = request.UserId,
                    FedSeason = request.FedSeason,
                    SportEventId = request.SportEventId,
                    Data = serialized,
                    UpdatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc),
                });
            }
            else
            {
                stored.Data = serialized;
                stored.UpdatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);
            }

            var playerIds = request.Players.Select(p => p.UniqueId).Distinct().ToList();

            var existing = await _db.SeasonPrepPlayerRatings
                .Where(r => r.UserId == request.UserId && r.FedSeason == request.FedSeason && r.SportEventId == request.SportEventId && playerIds.Contains(r.SeasonPrepPlayerId))
                .ToListAsync(cancellationToken);

            if (existing.Count > 0)
            {
                _db.SeasonPrepPlayerRatings.RemoveRange(existing);
            }

            foreach (var player in request.Players)
            {
                if (player.Rating is null)
                    continue;

                var answers = player.Rating.Answers
                    .Select(a => (a.CharacteristicKey, a.CategoryKey, a.Level, a.Concept))
                    .ToList()
                    .AsReadOnly();

                var rating = SeasonPrepPlayerRating.CreateConceptual(
                    request.UserId,
                    request.FedSeason,
                    request.SportEventId,
                    player.UniqueId,
                    player.Rating.IsGoalkeeper,
                    answers,
                    player.Rating.Notes,
                    player.Rating.RatedAt);

                _db.SeasonPrepPlayerRatings.Add(rating);
            }

            await _db.SaveChangesAsync(cancellationToken);
            return Unit.Value;
        }
    }
}
