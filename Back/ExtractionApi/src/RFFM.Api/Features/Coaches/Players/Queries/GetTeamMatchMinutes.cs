using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    /// <summary>
    /// Returns minutes played per player and per match (event) across all of a team's
    /// finished matches in a single call, avoiding one HTTP round-trip per player.
    /// </summary>
    public class GetTeamMatchMinutes : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(
                    "/api/catalog/team/{teamId}/match-minutes",
                    [Authorize] async (
                        string teamId,
                        IMediator mediator,
                        CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new Query { TeamId = teamId }, cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetTeamMatchMinutes))
                .WithTags("MatchParticipation")
                .Produces<MatchMinutesRow[]>();
        }

        // ─── Query ────────────────────────────────────────────────────────────

        public record Query : Common.IQueryApp<MatchMinutesRow[]>, IRequireFeaturePermission
        {
            public string TeamId { get; init; } = null!;

            public string FeatureRoute => CoachFeatureRoutes.AttendanceSummary;
            public string RequiredPermission => "Read";
        }

        public record MatchMinutesRow(string EventId, string TeamPlayerId, int MinutesPlayed);

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler : IRequestHandler<Query, MatchMinutesRow[]>
        {
            private readonly AppDbContext _db;

            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<MatchMinutesRow[]> Handle(Query request, CancellationToken cancellationToken = default)
            {
                return await _db.MatchParticipations
                    .AsNoTracking()
                    .Where(mp => mp.TeamId == request.TeamId && mp.MatchPhase == "finished")
                    .Select(mp => new MatchMinutesRow(mp.EventId, mp.TeamPlayerId, mp.MinutesPlayed))
                    .ToArrayAsync(cancellationToken);
            }
        }
    }
}
