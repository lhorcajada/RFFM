using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    /// <summary>
    /// Aggregate convocation/participation summary for a team player, used by the player
    /// "Estadísticas" tab redesign: how many matches they started, how many times they were
    /// called up in total, and the most recent match they missed for each of the two distinct
    /// reasons an absence can have — a coach decision (Deconvoke) versus the player's own
    /// circumstances (Justified). Kept as its own read-model endpoint (rather than folded into
    /// GetPlayerMatchHistory) because it answers a different question — aggregates and
    /// non-participation events — over a different query shape (Convocations, not just
    /// finished MatchParticipations).
    /// </summary>
    public class GetPlayerConvocationSummary : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(
                    "/api/catalog/team-player/{teamPlayerId}/convocation-summary",
                    async (string teamPlayerId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(
                            new PlayerConvocationSummaryQuery { TeamPlayerId = teamPlayerId },
                            cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetPlayerConvocationSummary))
                .WithTags("MatchParticipation")
                .Produces<PlayerConvocationSummaryDto>();
        }

        // ─── Query ────────────────────────────────────────────────────────────

        public record PlayerConvocationSummaryQuery : Common.IQueryApp<PlayerConvocationSummaryDto>
        {
            public string TeamPlayerId { get; init; } = null!;
        }

        public record PlayerConvocationSummaryDto(
            int TotalStarts,
            int TotalConvocations,
            PlayerAbsenceMatchDto? LastDeconvokedMatch,
            PlayerAbsenceMatchDto? LastJustifiedAbsenceMatch);

        public record PlayerAbsenceMatchDto(
            string EventId,
            DateTime? MatchDate,
            string? RivalName,
            int EventTypeId,
            string EventTypeName);

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler : IRequestHandler<PlayerConvocationSummaryQuery, PlayerConvocationSummaryDto>
        {
            private static readonly int DeconvokeStatusId = ConvocationStatus.FromName("Deconvoke").Id;
            private static readonly int JustifiedStatusId = ConvocationStatus.FromName("Justified").Id;

            private readonly AppDbContext _db;

            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<PlayerConvocationSummaryDto> Handle(
                PlayerConvocationSummaryQuery request,
                CancellationToken cancellationToken = default)
            {
                var totalStarts = await _db.MatchParticipations
                    .AsNoTracking()
                    .CountAsync(mp => mp.TeamPlayerId == request.TeamPlayerId && mp.MatchPhase == "finished" && mp.IsStarter, cancellationToken);

                var totalConvocations = await _db.Convocations
                    .AsNoTracking()
                    .CountAsync(c => c.TeamPlayerId == request.TeamPlayerId, cancellationToken);

                var lastDeconvokedMatch = await GetMostRecentAbsenceMatchAsync(
                    request.TeamPlayerId, DeconvokeStatusId, cancellationToken);

                var lastJustifiedAbsenceMatch = await GetMostRecentAbsenceMatchAsync(
                    request.TeamPlayerId, JustifiedStatusId, cancellationToken);

                return new PlayerConvocationSummaryDto(
                    totalStarts,
                    totalConvocations,
                    lastDeconvokedMatch,
                    lastJustifiedAbsenceMatch);
            }

            private async Task<PlayerAbsenceMatchDto?> GetMostRecentAbsenceMatchAsync(
                string teamPlayerId, int convocationStatusId, CancellationToken cancellationToken)
            {
                var convocation = await _db.Convocations
                    .AsNoTracking()
                    .Include(c => c.SportEvent)
                    .ThenInclude(se => se.Rival)
                    .Where(c => c.TeamPlayerId == teamPlayerId && c.ConvocationStatusId == convocationStatusId)
                    .OrderByDescending(c => c.SportEvent.EveDateTime ?? DateTime.MinValue)
                    .FirstOrDefaultAsync(cancellationToken);

                if (convocation is null) return null;

                var eventTypeId = convocation.SportEvent.EventTypeId;
                return new PlayerAbsenceMatchDto(
                    convocation.SportEventId,
                    convocation.SportEvent.EveDateTime,
                    convocation.SportEvent.Rival?.Name,
                    eventTypeId,
                    SportEventType.From(eventTypeId).Name);
            }
        }
    }
}
