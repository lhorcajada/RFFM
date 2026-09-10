using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Players.Services;
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
            int YellowCards,
            int RedCards,
            string? RivalName,
            int EventTypeId,
            string EventTypeName,
            List<SubstitutionWindowRecordDto> SubstitutionWindows,
            int ScoreLocal,
            int ScoreVisitor,
            DateTime? MatchDate,
            string? MinutesReason);

        public record SubstitutionWindowRecordDto(int WindowIndex, int Minute, int Half, List<SubstitutionSwapRecordDto> Swaps);
        public record SubstitutionSwapRecordDto(string InPlayerId, string? OutPlayerId, int SlotIndex);

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
                    .ToListAsync(cancellationToken);

                var eventIds = participations.Select(mp => mp.EventId).Distinct().ToList();

                var sportEvents = await _db.SportEvents
                    .AsNoTracking()
                    .Include(se => se.Rival)
                    .Where(se => eventIds.Contains(se.Id))
                    .ToListAsync(cancellationToken);
                var sportEventsById = sportEvents.ToDictionary(se => se.Id);

                return participations
                    .Select(mp =>
                    {
                        sportEventsById.TryGetValue(mp.EventId, out var sportEvent);
                        var eventTypeId = sportEvent?.EventTypeId ?? 0;
                        var eventTypeName = eventTypeId > 0 ? SportEventType.From(eventTypeId).Name : string.Empty;

                        return new PlayerMatchRecordDto(
                            mp.EventId,
                            mp.MinutesPlayed,
                            mp.IsStarter,
                            mp.EnteredAtMinute,
                            mp.ExitedAtMinute,
                            CountGoalsForPlayer(mp.GoalsJson, mp.TeamPlayerId),
                            PlayerCardCountService.CountCards(mp.CardsJson, mp.TeamPlayerId, "yellow"),
                            PlayerCardCountService.CountCards(mp.CardsJson, mp.TeamPlayerId, "red"),
                            sportEvent?.Rival?.Name,
                            eventTypeId,
                            eventTypeName,
                            ParseSubstitutionWindows(mp.SubstitutionWindowsJson),
                            mp.ScoreLocal,
                            mp.ScoreVisitor,
                            sportEvent?.EveDateTime,
                            mp.MinutesReason);
                    })
                    // Most recent match first; matches with no known date (shouldn't normally happen
                    // for a finished participation) sort last instead of first.
                    .OrderByDescending(r => r.MatchDate ?? DateTime.MinValue)
                    .ToList();
            }

            /// <summary>
            /// Deserializes SubstitutionWindowsJson into SubstitutionWindowRecordDto. Returns an
            /// empty list for null/malformed JSON (same try/catch pattern as CountGoalsForPlayer).
            /// </summary>
            private static List<SubstitutionWindowRecordDto> ParseSubstitutionWindows(string? substitutionWindowsJson)
            {
                if (string.IsNullOrEmpty(substitutionWindowsJson)) return new List<SubstitutionWindowRecordDto>();

                try
                {
                    return JsonSerializer.Deserialize<List<SubstitutionWindowRecordDto>>(
                        substitutionWindowsJson,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new List<SubstitutionWindowRecordDto>();
                }
                catch
                {
                    return new List<SubstitutionWindowRecordDto>();
                }
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
