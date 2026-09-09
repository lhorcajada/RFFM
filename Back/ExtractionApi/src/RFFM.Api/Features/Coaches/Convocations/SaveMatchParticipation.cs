using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Players.Services;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Convocations
{
    public class SaveMatchParticipation : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost(
                    "/api/events/{eventId}/match-participation",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string eventId, SaveMatchParticipationRequest request, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        request = request with { EventId = eventId };
                        await mediator.Send(request, cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(SaveMatchParticipation))
                .WithTags("MatchParticipation")
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status403Forbidden);
        }

        // ─── Request ──────────────────────────────────────────────────────────

        public record SaveMatchParticipationRequest : IRequest<Unit>
        {
            public string EventId { get; init; } = null!;
            public string TeamId { get; init; } = null!;
            public int ScoreLocal { get; init; }
            public int ScoreVisitor { get; init; }
            public string MatchPhase { get; init; } = "finished";
            public List<PlayerParticipationDto> Players { get; init; } = new();
            public string? SubstitutionWindowsJson { get; init; }
            public string? RatingSnapshotsJson { get; init; }
            public string? GoalsJson { get; init; }
            public string? CardsJson { get; init; }
            public string? FormationChangesJson { get; init; }
        }

        public record PlayerParticipationDto(
            string TeamPlayerId,
            int MinutesPlayed,
            bool IsStarter,
            int? EnteredAtMinute,
            int? ExitedAtMinute);

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler : IRequestHandler<SaveMatchParticipationRequest, Unit>
        {
            private static readonly int MatchEventTypeId = SportEventType.FromName("Partido").Id;
            private const string FiveYellowsSanctionType = "Amarillas acumuladas (5)";
            private const string RedCardSanctionType = "Tarjeta roja";

            private readonly AppDbContext _db;

            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<Unit> Handle(
                SaveMatchParticipationRequest request,
                CancellationToken cancellationToken = default)
            {
                // Load existing records for this event in one query
                var existing = await _db.MatchParticipations
                    .Where(mp => mp.EventId == request.EventId)
                    .ToListAsync(cancellationToken);

                var existingByPlayerId = existing.ToDictionary(mp => mp.TeamPlayerId);

                foreach (var dto in request.Players)
                {
                    if (existingByPlayerId.TryGetValue(dto.TeamPlayerId, out var record))
                    {
                        // Update existing record
                        record.Update(
                            dto.MinutesPlayed,
                            dto.IsStarter,
                            dto.EnteredAtMinute,
                            dto.ExitedAtMinute,
                            request.ScoreLocal,
                            request.ScoreVisitor,
                            request.MatchPhase,
                            request.SubstitutionWindowsJson,
                            request.RatingSnapshotsJson,
                            request.GoalsJson,
                            request.CardsJson,
                            request.FormationChangesJson);
                    }
                    else
                    {
                        // Create new record
                        var newRecord = MatchParticipation.Create(
                            request.EventId,
                            request.TeamId,
                            dto.TeamPlayerId,
                            dto.MinutesPlayed,
                            dto.IsStarter,
                            dto.EnteredAtMinute,
                            dto.ExitedAtMinute,
                            request.ScoreLocal,
                            request.ScoreVisitor,
                            request.MatchPhase,
                            request.SubstitutionWindowsJson,
                            request.RatingSnapshotsJson,
                            request.GoalsJson,
                            request.CardsJson,
                            request.FormationChangesJson);

                        _db.MatchParticipations.Add(newRecord);
                    }
                }

                if (request.MatchPhase == "finished")
                {
                    var sportEvent = await _db.SportEvents
                        .FirstOrDefaultAsync(se => se.Id == request.EventId, cancellationToken);
                    if (sportEvent is not null)
                    {
                        sportEvent.LocalGoals = request.ScoreLocal.ToString();
                        sportEvent.VisitorGoals = request.ScoreVisitor.ToString();
                    }
                }

                await _db.SaveChangesAsync(cancellationToken);

                if (request.MatchPhase == "finished")
                {
                    await DetectAndCreateAutomaticSanctionsAsync(request, cancellationToken);
                }

                return Unit.Value;
            }

            /// <summary>
            /// Detects, for every player of a finished "Partido" (league match), whether they
            /// reached their 5th cyclic yellow card or received a red card, and creates the
            /// corresponding automatic TeamPlayerSanction (design.md Decisión 3). No-op for
            /// friendlies/tournaments/trainings, and idempotent per (TeamPlayerId, SourceEventId,
            /// SanctionType) so re-saving the same finished match never duplicates a sanction.
            /// </summary>
            private async Task DetectAndCreateAutomaticSanctionsAsync(
                SaveMatchParticipationRequest request, CancellationToken cancellationToken)
            {
                var sportEvent = await _db.SportEvents
                    .FirstOrDefaultAsync(se => se.Id == request.EventId, cancellationToken);
                if (sportEvent is null || sportEvent.EventTypeId != MatchEventTypeId) return;

                var rival = sportEvent.RivalId is not null
                    ? await _db.Rivals.AsNoTracking().FirstOrDefaultAsync(r => r.Id == sportEvent.RivalId, cancellationToken)
                    : null;

                var startDate = sportEvent.EveDateTime ?? DateTime.UtcNow;
                var matchDateText = startDate.ToString("dd/MM/yyyy");
                var rivalText = rival?.Name ?? "rival desconocido";

                var createdAny = false;

                foreach (var dto in request.Players)
                {
                    if (PlayerCardCountService.HasRedCard(request.CardsJson, dto.TeamPlayerId))
                    {
                        var alreadySanctioned = await _db.TeamPlayerSanctions.AnyAsync(s =>
                            s.TeamPlayerId == dto.TeamPlayerId && s.IsAutomatic &&
                            s.SourceEventId == request.EventId && s.SanctionType == RedCardSanctionType,
                            cancellationToken);

                        if (!alreadySanctioned)
                        {
                            _db.TeamPlayerSanctions.Add(TeamPlayerSanction.CreateAutomatic(
                                dto.TeamPlayerId, SanctionCategory.Competition, startDate, RedCardSanctionType,
                                $"Generada automáticamente: expulsión (tarjeta roja) en el partido del {matchDateText} vs {rivalText}.",
                                request.EventId));
                            createdAny = true;
                        }
                    }

                    var cyclicYellowCount = await ComputeCyclicYellowCountAsync(dto.TeamPlayerId, cancellationToken);
                    if (cyclicYellowCount >= 5)
                    {
                        var alreadySanctioned = await _db.TeamPlayerSanctions.AnyAsync(s =>
                            s.TeamPlayerId == dto.TeamPlayerId && s.IsAutomatic &&
                            s.SourceEventId == request.EventId && s.SanctionType == FiveYellowsSanctionType,
                            cancellationToken);

                        if (!alreadySanctioned)
                        {
                            _db.TeamPlayerSanctions.Add(TeamPlayerSanction.CreateAutomatic(
                                dto.TeamPlayerId, SanctionCategory.Competition, startDate, FiveYellowsSanctionType,
                                $"Generada automáticamente: 5ª tarjeta amarilla en el partido del {matchDateText} vs {rivalText}.",
                                request.EventId));
                            createdAny = true;
                        }
                    }
                }

                if (createdAny)
                {
                    await _db.SaveChangesAsync(cancellationToken);
                }
            }

            /// <summary>
            /// Cyclic yellow-card count for a player (design.md Decisión 2): sum of yellow cards
            /// across all finished "Partido" MatchParticipation rows whose SportEvent date is
            /// strictly after the StartDate of the player's most recent automatic 5-yellows
            /// sanction (or all of them, if there isn't one yet).
            /// </summary>
            private async Task<int> ComputeCyclicYellowCountAsync(string teamPlayerId, CancellationToken cancellationToken)
            {
                var participations = await _db.MatchParticipations
                    .AsNoTracking()
                    .Where(mp => mp.TeamPlayerId == teamPlayerId && mp.MatchPhase == "finished")
                    .ToListAsync(cancellationToken);

                var eventIds = participations.Select(mp => mp.EventId).Distinct().ToList();
                var matchEventDatesById = await _db.SportEvents
                    .AsNoTracking()
                    .Where(se => eventIds.Contains(se.Id) && se.EventTypeId == MatchEventTypeId)
                    .ToDictionaryAsync(se => se.Id, se => se.EveDateTime, cancellationToken);

                var matchParticipations = participations
                    .Where(mp => matchEventDatesById.ContainsKey(mp.EventId))
                    .Select(mp => (Participation: mp, EventDate: matchEventDatesById[mp.EventId]))
                    .ToList();

                var lastFiveYellowsSanction = await _db.TeamPlayerSanctions
                    .AsNoTracking()
                    .Where(s => s.TeamPlayerId == teamPlayerId && s.IsAutomatic && s.SanctionType == FiveYellowsSanctionType)
                    .OrderByDescending(s => s.StartDate)
                    .FirstOrDefaultAsync(cancellationToken);

                return PlayerCardCountService.CountCyclicYellowCards(
                    matchParticipations, teamPlayerId, lastFiveYellowsSanction?.StartDate);
            }
        }
    }
}
