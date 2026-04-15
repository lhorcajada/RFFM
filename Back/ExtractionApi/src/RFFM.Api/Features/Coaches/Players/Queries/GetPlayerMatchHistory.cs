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
    /// Returns per-match participation history for a specific team player,
    /// ordered by most recent save first.
    /// </summary>
    public class GetPlayerMatchHistory : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(
                    "/api/catalog/team-player/{teamPlayerId}/match-history",
                    async (string teamPlayerId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(
                            new PlayerMatchHistoryQuery { TeamPlayerId = teamPlayerId },
                            cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetPlayerMatchHistory))
                .WithTags("MatchParticipation")
                .Produces<List<PlayerMatchRecordDto>>();
        }

        // ─── Query ────────────────────────────────────────────────────────────

        public record PlayerMatchHistoryQuery : Common.IQueryApp<List<PlayerMatchRecordDto>>
        {
            public string TeamPlayerId { get; init; } = null!;
        }

        public record PlayerMatchRecordDto(
            string EventId,
            int MinutesPlayed,
            bool IsStarter,
            int? EnteredAtMinute,
            int? ExitedAtMinute,
            int GoalsScored,
            int ScoreLocal,
            int ScoreVisitor,
            DateTime SavedAt);

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler : IRequestHandler<PlayerMatchHistoryQuery, List<PlayerMatchRecordDto>>
        {
            private readonly AppDbContext _db;

            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<List<PlayerMatchRecordDto>> Handle(
                PlayerMatchHistoryQuery request,
                CancellationToken cancellationToken = default)
            {
                var participations = await _db.MatchParticipations
                    .AsNoTracking()
                    .Where(mp => mp.TeamPlayerId == request.TeamPlayerId && mp.MatchPhase == "finished")
                    .OrderByDescending(mp => mp.UpdatedAt)
                    .ToListAsync(cancellationToken);

                return participations.Select(mp => new PlayerMatchRecordDto(
                    mp.EventId,
                    mp.MinutesPlayed,
                    mp.IsStarter,
                    mp.EnteredAtMinute,
                    mp.ExitedAtMinute,
                    CountGoalsForPlayer(mp.GoalsJson, mp.TeamPlayerId),
                    mp.ScoreLocal,
                    mp.ScoreVisitor,
                    mp.UpdatedAt)).ToList();
            }

            /// <summary>
            /// Parses GoalsJson to count goals where scorerId == teamPlayerId and isOwnTeam == true.
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
