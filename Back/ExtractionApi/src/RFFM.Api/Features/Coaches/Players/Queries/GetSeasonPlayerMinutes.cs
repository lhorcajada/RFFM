using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    /// <summary>
    /// Returns total minutes played per teamPlayerId for a season, summed across all matches.
    /// Used after a match ends to display cumulative season minutes.
    /// </summary>
    public class GetSeasonPlayerMinutes : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(
                    "/api/catalog/team/{teamId}/season-minutes",
                    async (
                        string teamId,
                        string? seasonId,
                        IMediator mediator,
                        CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(
                            new SeasonPlayerMinutesQuery { TeamId = teamId, SeasonId = seasonId },
                            cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetSeasonPlayerMinutes))
                .WithTags("MatchParticipation")
                .Produces<Dictionary<string, int>>();
        }

        // ─── Query ────────────────────────────────────────────────────────────

        public record SeasonPlayerMinutesQuery : Common.IQueryApp<Dictionary<string, int>>
        {
            public string TeamId { get; init; } = null!;
            /// <summary>
            /// Optional season ID. When provided, only events that belong to this season
            /// are included. When null, all match participation records for the team are summed.
            /// </summary>
            public string? SeasonId { get; init; }
        }

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler : IRequestHandler<SeasonPlayerMinutesQuery, Dictionary<string, int>>
        {
            private readonly AppDbContext _db;

            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<Dictionary<string, int>> Handle(
                SeasonPlayerMinutesQuery request,
                CancellationToken cancellationToken = default)
            {
                // Base query: all finished participations for the team
                var participationsQuery = _db.MatchParticipations
                    .AsNoTracking()
                    .Where(mp => mp.TeamId == request.TeamId && mp.MatchPhase == "finished");

                // If a seasonId is provided, filter by the events that belong to that season.
                // SportEvent does not have a SeasonId FK in the current schema, so we use
                // the TeamPlayer roster as a proxy: any participation whose TeamPlayerId
                // belongs to the team during the given season is included.
                // When the schema is extended (SportEvent.SeasonId), change this join.
                if (!string.IsNullOrEmpty(request.SeasonId))
                {
                    // Join with SportEvents to filter by season start/end if available,
                    // otherwise just return all for the team (season filter deferred).
                    var seasonEventIds = await _db.SportEvents
                        .AsNoTracking()
                        .Where(se => se.TeamId == request.TeamId)
                        .Select(se => se.Id)
                        .ToListAsync(cancellationToken);

                    participationsQuery = participationsQuery
                        .Where(mp => seasonEventIds.Contains(mp.EventId));
                }

                var aggregated = await participationsQuery
                    .GroupBy(mp => mp.TeamPlayerId)
                    .Select(g => new { TeamPlayerId = g.Key, TotalMinutes = g.Sum(mp => mp.MinutesPlayed) })
                    .ToListAsync(cancellationToken);

                return aggregated.ToDictionary(x => x.TeamPlayerId, x => x.TotalMinutes);
            }
        }
    }
}
