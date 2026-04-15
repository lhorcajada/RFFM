using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using System.Text.Json;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    /// <summary>
    /// Returns aggregated season statistics per player for a given team:
    /// total minutes played, goals scored, starts, and matches participated in.
    /// Goals are computed by parsing the GoalsJson field of each finished participation.
    /// </summary>
    public class GetSeasonPlayerStats : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(
                    "/api/catalog/team/{teamId}/season-stats",
                    async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(
                            new SeasonPlayerStatsQuery { TeamId = teamId },
                            cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetSeasonPlayerStats))
                .WithTags("MatchParticipation")
                .Produces<List<PlayerSeasonStatsDto>>();
        }

        // ─── Query ────────────────────────────────────────────────────────────

        public record SeasonPlayerStatsQuery : Common.IQueryApp<List<PlayerSeasonStatsDto>>
        {
            public string TeamId { get; init; } = null!;
        }

        public record PlayerSeasonStatsDto(
            string TeamPlayerId,
            int TotalMinutes,
            int TotalGoals,
            int TotalStarts,
            int TotalMatches);

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler : IRequestHandler<SeasonPlayerStatsQuery, List<PlayerSeasonStatsDto>>
        {
            private readonly AppDbContext _db;

            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<List<PlayerSeasonStatsDto>> Handle(
                SeasonPlayerStatsQuery request,
                CancellationToken cancellationToken = default)
            {
                var participations = await _db.MatchParticipations
                    .AsNoTracking()
                    .Where(mp => mp.TeamId == request.TeamId && mp.MatchPhase == "finished")
                    .ToListAsync(cancellationToken);

                // Group by player and aggregate
                var grouped = participations
                    .GroupBy(mp => mp.TeamPlayerId)
                    .Select(g =>
                    {
                        var teamPlayerId = g.Key;
                        var totalMinutes = g.Sum(mp => mp.MinutesPlayed);
                        var totalStarts = g.Count(mp => mp.IsStarter);
                        var totalMatches = g.Count();
                        var totalGoals = g.Sum(mp => CountGoalsForPlayer(mp.GoalsJson, teamPlayerId));

                        return new PlayerSeasonStatsDto(
                            teamPlayerId,
                            totalMinutes,
                            totalGoals,
                            totalStarts,
                            totalMatches);
                    })
                    .ToList();

                return grouped;
            }

            /// <summary>
            /// Parses GoalsJson to count goals where scorerId == teamPlayerId and isOwnTeam == true.
            /// Returns 0 for null or malformed JSON.
            /// </summary>
            private static int CountGoalsForPlayer(string? goalsJson, string teamPlayerId)
            {
                if (string.IsNullOrEmpty(goalsJson)) return 0;

                try
                {
                    using var doc = JsonDocument.Parse(goalsJson);
                    if (doc.RootElement.ValueKind != JsonValueKind.Array) return 0;

                    int count = 0;
                    foreach (var goal in doc.RootElement.EnumerateArray())
                    {
                        var isOwnTeam = goal.TryGetProperty("isOwnTeam", out var ownProp) &&
                                        ownProp.GetBoolean();
                        var scorerId = goal.TryGetProperty("scorerId", out var idProp)
                            ? idProp.GetString()
                            : null;

                        if (isOwnTeam && scorerId == teamPlayerId)
                            count++;
                    }
                    return count;
                }
                catch
                {
                    return 0;
                }
            }
        }
    }
}
