using System.Linq.Expressions;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    /// <summary>
    /// Aggregate convocation/participation summary for a team player, used by the player
    /// "Estadísticas" tab: how many matches they started, how many times they were called up
    /// in total (and broken down by training/friendly/league), and the most recent match they
    /// missed for each of the two distinct absence reasons — a coach decision (ConvocationStatus
    /// Deconvoke) versus being accepted but not attending on the day (AssistanceType
    /// Excused/UnexcusedAbsence, set via the "Asistencia" flow). Kept as its own read-model
    /// endpoint (rather than folded into GetPlayerMatchHistory) because it answers a different
    /// question — aggregates and non-participation events — over a different query shape
    /// (Convocations, not just finished MatchParticipations).
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
            int TotalTrainingConvocations,
            int TotalFriendlyConvocations,
            int TotalLeagueConvocations,
            PlayerAbsenceMatchDto? LastDeconvokedMatch,
            PlayerAbsenceMatchDto? LastAbsenceMatch);

        public record PlayerAbsenceMatchDto(
            string EventId,
            DateTime? MatchDate,
            string? RivalName,
            int EventTypeId,
            string EventTypeName,
            string? Reason);

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler : IRequestHandler<PlayerConvocationSummaryQuery, PlayerConvocationSummaryDto>
        {
            private static readonly int DeconvokeStatusId = ConvocationStatus.FromName("Deconvoke").Id;
            private static readonly int ExcusedAbsenceTypeId = AssistanceType.ExcusedAbsence.Id;
            private static readonly int UnexcusedAbsenceTypeId = AssistanceType.UnexcusedAbsence.Id;

            private readonly AppDbContext _db;

            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<PlayerConvocationSummaryDto> Handle(
                PlayerConvocationSummaryQuery request,
                CancellationToken cancellationToken = default)
            {
                var totalStarts = await _db.MatchParticipations
                    .AsNoTracking()
                    .CountAsync(mp => mp.TeamPlayerId == request.TeamPlayerId && mp.MatchPhase == "finished" && mp.IsStarter, cancellationToken);

                var countsByEventType = await _db.Convocations
                    .AsNoTracking()
                    .Where(c => c.TeamPlayerId == request.TeamPlayerId)
                    .GroupBy(c => c.SportEvent.EventTypeId)
                    .Select(g => new { EventTypeId = g.Key, Count = g.Count() })
                    .ToListAsync(cancellationToken);

                int CountFor(int eventTypeId) =>
                    countsByEventType.FirstOrDefault(x => x.EventTypeId == eventTypeId)?.Count ?? 0;

                var totalConvocations = countsByEventType.Sum(x => x.Count);
                var totalTrainingConvocations = CountFor(SportEventType.TrainingId);
                var totalFriendlyConvocations = CountFor(SportEventsConstants.FriendlyEventTypeId);
                var totalLeagueConvocations = CountFor(SportEventsConstants.MatchEventTypeId);

                var lastDeconvokedMatch = await GetMostRecentAbsenceMatchAsync(
                    request.TeamPlayerId,
                    c => c.ConvocationStatusId == DeconvokeStatusId,
                    cancellationToken);

                var lastAbsenceMatch = await GetMostRecentAbsenceMatchAsync(
                    request.TeamPlayerId,
                    c => c.AssistanceTypeId == ExcusedAbsenceTypeId || c.AssistanceTypeId == UnexcusedAbsenceTypeId,
                    cancellationToken);

                return new PlayerConvocationSummaryDto(
                    totalStarts,
                    totalConvocations,
                    totalTrainingConvocations,
                    totalFriendlyConvocations,
                    totalLeagueConvocations,
                    lastDeconvokedMatch,
                    lastAbsenceMatch);
            }

            private async Task<PlayerAbsenceMatchDto?> GetMostRecentAbsenceMatchAsync(
                string teamPlayerId,
                Expression<Func<Convocation, bool>> absencePredicate,
                CancellationToken cancellationToken)
            {
                var convocation = await _db.Convocations
                    .AsNoTracking()
                    .Include(c => c.SportEvent)
                    .ThenInclude(se => se.Rival)
                    .Include(c => c.ExcuseType)
                    .Where(c => c.TeamPlayerId == teamPlayerId)
                    .Where(absencePredicate)
                    .OrderByDescending(c => c.SportEvent.EveDateTime ?? DateTime.MinValue)
                    .FirstOrDefaultAsync(cancellationToken);

                if (convocation is null) return null;

                var eventTypeId = convocation.SportEvent.EventTypeId;
                return new PlayerAbsenceMatchDto(
                    convocation.SportEventId,
                    convocation.SportEvent.EveDateTime,
                    convocation.SportEvent.Rival?.Name,
                    eventTypeId,
                    SportEventType.From(eventTypeId).Name,
                    convocation.ExcuseType?.Name);
            }
        }
    }
}
