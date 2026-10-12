using System.Text.Json;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Lineup
{
    /// <summary>
    /// Lineup a match without a saved one starts from: the one the team's previous match of the
    /// same category (league, friendly or tournament) kicked off with or, if that match was not
    /// tracked live, the one saved for it.
    /// </summary>
    public class GetPreviousMatchLineup : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/team/{teamId}/events/{eventId}/previous-match-lineup",
                    async (string teamId, string eventId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new GetPreviousMatchLineupQuery(teamId, eventId), cancellationToken);
                        return result is null ? Results.NotFound() : Results.Ok(result);
                    })
                .WithName(nameof(GetPreviousMatchLineup))
                .WithTags("Lineup")
                .RequireAuthorization()
                .Produces<PreviousMatchLineupDto>()
                .Produces(StatusCodes.Status404NotFound);
        }

        public record GetPreviousMatchLineupQuery(string TeamId, string EventId) : IQueryApp<PreviousMatchLineupDto?>;

        public record PreviousMatchLineupSlotDto(int SlotIndex, string TeamPlayerId);

        public record PreviousMatchLineupDto(string FormationId, IEnumerable<PreviousMatchLineupSlotDto> Slots);

        public class Handler : IRequestHandler<GetPreviousMatchLineupQuery, PreviousMatchLineupDto?>
        {
            // How many previous matches are looked at to find one with a lineup
            private const int MaxPreviousMatches = 10;

            private static readonly int[] MatchEventTypeIds =
            {
                SportEventsConstants.MatchEventTypeId,
                SportEventsConstants.FriendlyEventTypeId,
                SportEventsConstants.TournamentEventTypeId
            };

            private readonly AppDbContext _db;

            public Handler(AppDbContext db)
            {
                _db = db;
            }

            private record StartingLineupJson(string? FormationId, Dictionary<string, string?>? Slots);

            public async ValueTask<PreviousMatchLineupDto?> Handle(GetPreviousMatchLineupQuery request, CancellationToken cancellationToken = default)
            {
                var current = await _db.SportEvents
                    .AsNoTracking()
                    .Where(e => e.Id == request.EventId && e.TeamId == request.TeamId)
                    .Select(e => new { e.EventTypeId, e.EveDateTime })
                    .FirstOrDefaultAsync(cancellationToken);

                var isDatedMatch = current?.EveDateTime != null && MatchEventTypeIds.Contains(current.EventTypeId);
                if (!isDatedMatch) return null;

                var previousEventIds = await _db.SportEvents
                    .AsNoTracking()
                    .Where(e => e.TeamId == request.TeamId
                                && e.EventTypeId == current!.EventTypeId
                                && e.EveDateTime < current.EveDateTime)
                    .OrderByDescending(e => e.EveDateTime)
                    .Select(e => e.Id)
                    .Take(MaxPreviousMatches)
                    .ToListAsync(cancellationToken);

                if (previousEventIds.Count == 0) return null;

                var startedLineups = await _db.MatchParticipations
                    .AsNoTracking()
                    .Where(mp => previousEventIds.Contains(mp.EventId) && mp.TeamId == request.TeamId && mp.StartingLineupJson != null)
                    .Select(mp => new { mp.EventId, mp.StartingLineupJson })
                    .ToListAsync(cancellationToken);

                var savedLineups = await _db.TeamIdealLineups
                    .AsNoTracking()
                    .Where(l => l.TeamId == request.TeamId && previousEventIds.Contains(l.SeasonId))
                    .Select(l => new
                    {
                        EventId = l.SeasonId,
                        l.FormationId,
                        Slots = l.Slots.Where(s => s.TeamPlayerId != null).Select(s => new { s.SlotIndex, s.TeamPlayerId }).ToList()
                    })
                    .ToListAsync(cancellationToken);

                foreach (var eventId in previousEventIds)
                {
                    var started = startedLineups
                        .Where(l => l.EventId == eventId)
                        .Select(l => ParseStartingLineup(l.StartingLineupJson))
                        .FirstOrDefault(l => l != null);
                    if (started != null) return started;

                    var saved = savedLineups.FirstOrDefault(l => l.EventId == eventId && l.Slots.Count > 0);
                    if (saved != null)
                    {
                        return new PreviousMatchLineupDto(
                            saved.FormationId,
                            saved.Slots.Select(s => new PreviousMatchLineupSlotDto(s.SlotIndex, s.TeamPlayerId!)).ToList());
                    }
                }

                return null;
            }

            private static PreviousMatchLineupDto? ParseStartingLineup(string? json)
            {
                if (string.IsNullOrWhiteSpace(json)) return null;
                try
                {
                    var parsed = JsonSerializer.Deserialize<StartingLineupJson>(json, JsonSerializerOptions.Web);
                    if (string.IsNullOrEmpty(parsed?.FormationId) || parsed.Slots is null) return null;

                    var slots = parsed.Slots
                        .Where(s => !string.IsNullOrEmpty(s.Value) && int.TryParse(s.Key, out _))
                        .Select(s => new PreviousMatchLineupSlotDto(int.Parse(s.Key), s.Value!))
                        .OrderBy(s => s.SlotIndex)
                        .ToList();

                    return slots.Count == 0 ? null : new PreviousMatchLineupDto(parsed.FormationId, slots);
                }
                catch (JsonException)
                {
                    return null;
                }
            }
        }
    }
}
