using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Players.Services;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    /// <summary>
    /// Evolución diaria de Estado de forma, Rodaje y Cansancio de un jugador, reconstruida al vuelo
    /// con los datos actuales (sin snapshots). El último punto coincide con
    /// <see cref="GetTeamPlayerStatistics"/>. See openspec/changes/player-physical-evolution/design.md → D6.
    /// </summary>
    public class GetPlayerPhysicalEvolution : IFeatureModule
    {
        public const int DefaultDays = 28;
        public static readonly int[] AllowedDays = { 28, 56, 84 };
        public const string EventKindTraining = "Training";
        public const string EventKindMatch = "Match";

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(
                    "/api/catalog/team/{teamId}/players/{teamPlayerId}/physical-evolution",
                    async (string teamId, string teamPlayerId, int? days, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Query { TeamId = teamId, TeamPlayerId = teamPlayerId, Days = days ?? DefaultDays }, ct)))
                .WithName(nameof(GetPlayerPhysicalEvolution))
                .WithTags("Coaches")
                .Produces<PlayerPhysicalEvolutionDto>()
                .ProducesValidationProblem()
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record Query : IQueryApp<PlayerPhysicalEvolutionDto>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; init; } = null!;
            public string TeamPlayerId { get; init; } = null!;
            public int Days { get; init; } = DefaultDays;
            public string FeatureRoute => CoachFeatureRoutes.Squad;
            public string RequiredPermission => "Read";
        }

        public class Validator : AbstractValidator<Query>
        {
            public Validator()
            {
                RuleFor(q => q.TeamId).NotEmpty();
                RuleFor(q => q.TeamPlayerId).NotEmpty();
                RuleFor(q => q.Days)
                    .Must(d => AllowedDays.Contains(d))
                    .WithMessage($"days debe ser uno de: {string.Join(", ", AllowedDays)}.");
            }
        }

        public record PlayerPhysicalEvolutionDto(
            string TeamPlayerId,
            int Days,
            bool FormStatusAvailable,
            PhysicalEvolutionPointDto[] Points,        // más antiguo primero, Points[^1] = hoy
            PhysicalEvolutionEventDto[] Events,        // entrenos asistidos y partidos con minutos dentro del rango
            PhysicalEvolutionInjuryDto[] Injuries);    // lesiones que solapan el rango

        public record PhysicalEvolutionPointDto(DateTime Date, int? FormStatus, int? Readiness, int Fatigue);

        public record PhysicalEvolutionEventDto(
            DateTime Date, string EventId, int EventTypeId, string Kind,
            IReadOnlyList<string> TrainingTypes, int MinutesPlayed);

        public record PhysicalEvolutionInjuryDto(DateTime StartDate, DateTime? EndDate);

        public class Handler(AppDbContext db) : IRequestHandler<Query, PlayerPhysicalEvolutionDto>
        {
            private static readonly int[] MatchLikeEventTypeIds =
            {
                SportEventsConstants.MatchEventTypeId,
                SportEventsConstants.FriendlyEventTypeId,
                SportEventsConstants.TournamentEventTypeId
            };

            public async ValueTask<PlayerPhysicalEvolutionDto> Handle(Query request, CancellationToken cancellationToken)
            {
                var teamPlayer = await db.TeamPlayers
                    .AsNoTracking()
                    .Where(tp => tp.Id == request.TeamPlayerId && tp.TeamId == request.TeamId)
                    .Select(tp => new { tp.Id, tp.JoinedDate, tp.LeftDate })
                    .SingleOrDefaultAsync(cancellationToken)
                    ?? throw new NotFoundException($"TeamPlayer '{request.TeamPlayerId}' Not Found", ErrorCodes.TeamPlayerNotFound);

                var nowUtc = DateTime.UtcNow;
                var today = nowUtc.Date;
                var rangeStart = today.AddDays(-(request.Days - 1));
                var loadStart = rangeStart.AddDays(-(DailyLoadModel.ReplayDays - 1));
                var trainingEventTypeId = SportEventType.FromName("Entrenamiento").Id;

                var teamCategoryId = await db.Teams
                    .AsNoTracking()
                    .Where(t => t.Id == request.TeamId)
                    .Select(t => t.CategoryId)
                    .SingleAsync(cancellationToken);
                int? categoryHalfMinutes = MatchDurationMinutesByCategory.TryGetMinutes(teamCategoryId, out var halfMinutes) ? halfMinutes : null;

                var eventsInWindow = await db.SportEvents
                    .AsNoTracking()
                    .Where(se => se.TeamId == request.TeamId && se.EveDateTime != null && se.EveDateTime >= loadStart)
                    .Select(se => new { se.Id, Date = se.EveDateTime!.Value, se.EventTypeId, se.TrainingTypes })
                    .ToListAsync(cancellationToken);
                var eventById = eventsInWindow.ToDictionary(e => e.Id);
                var eventIds = eventsInWindow.Select(e => e.Id).ToList();

                var playerConvocations = await db.Convocations
                    .AsNoTracking()
                    .Where(c => c.TeamPlayerId == teamPlayer.Id && eventIds.Contains(c.SportEventId))
                    .Select(c => new { c.SportEventId, c.AssistanceTypeId, c.ConvocationStatusId, c.ExcuseTypeId })
                    .ToListAsync(cancellationToken);

                var finishedParticipations = await db.MatchParticipations
                    .AsNoTracking()
                    .Where(mp => mp.TeamId == request.TeamId && mp.MatchPhase == "finished" && eventIds.Contains(mp.EventId))
                    .Select(mp => new { mp.EventId, mp.TeamPlayerId, mp.MinutesPlayed })
                    .ToListAsync(cancellationToken);
                var playerParticipations = finishedParticipations.Where(mp => mp.TeamPlayerId == teamPlayer.Id).ToList();

                var trainingRows = playerConvocations
                    .Where(c => eventById[c.SportEventId].EventTypeId == trainingEventTypeId)
                    .Select(c =>
                    {
                        var e = eventById[c.SportEventId];
                        return new PlayerLoadInputsBuilder.TrainingConvocationRow(
                            e.Id, e.Date, e.TrainingTypes, c.AssistanceTypeId, c.ConvocationStatusId, c.ExcuseTypeId);
                    })
                    .ToList();

                var teamMatches = finishedParticipations
                    .Select(mp => mp.EventId)
                    .Distinct()
                    .Select(id => eventById[id])
                    .Where(e => MatchLikeEventTypeIds.Contains(e.EventTypeId) && e.Date <= nowUtc)
                    .Select(e => new PlayerLoadInputsBuilder.TeamMatchRow(e.Id, e.Date, e.EventTypeId))
                    .ToList();
                var teamMatchIds = teamMatches.Select(m => m.EventId).ToHashSet();

                var rows = new PlayerPhysicalEvolutionCalculator.PlayerLoadRows(
                    trainingRows,
                    teamMatches,
                    playerParticipations.GroupBy(mp => mp.EventId).ToDictionary(g => g.Key, g => g.Sum(mp => mp.MinutesPlayed)),
                    playerConvocations
                        .Where(c => teamMatchIds.Contains(c.SportEventId) && eventById[c.SportEventId].Date < nowUtc)
                        .GroupBy(c => c.SportEventId)
                        .ToDictionary(
                            g => g.Key,
                            g => new PlayerLoadInputsBuilder.MatchConvocationRow(g.Key, g.First().AssistanceTypeId, g.First().ConvocationStatusId, g.First().ExcuseTypeId)),
                    playerParticipations
                        .Select(mp => new PlayerLoadInputsBuilder.MatchParticipationRow(mp.EventId, eventById[mp.EventId].Date, eventById[mp.EventId].EventTypeId, mp.MinutesPlayed))
                        .ToList(),
                    teamPlayer.JoinedDate,
                    teamPlayer.LeftDate);

                var points = PlayerPhysicalEvolutionCalculator.Calculate(rows, nowUtc, request.Days, categoryHalfMinutes)
                    .Select(p => new PhysicalEvolutionPointDto(p.Date, p.FormStatus, p.Readiness, p.Fatigue))
                    .ToArray();

                var trainingEvents = PlayerLoadInputsBuilder.Trainings(trainingRows, nowUtc)
                    .Where(t => t.Outcome == ParticipationOutcome.Attended && t.Date >= rangeStart)
                    .Select(t => new PhysicalEvolutionEventDto(t.Date, t.EventId, trainingEventTypeId, EventKindTraining, t.TrainingTypes, 0));
                var matchEvents = PlayerLoadInputsBuilder.Matches(teamMatches, rows.MinutesByEvent, rows.MatchConvocations, rows.JoinedDate, rows.LeftDate, nowUtc)
                    .Where(m => m.MinutesPlayed > 0 && m.Date >= rangeStart)
                    .Select(m => new PhysicalEvolutionEventDto(m.Date, m.EventId, m.EventTypeId, EventKindMatch, Array.Empty<string>(), m.MinutesPlayed));
                var events = trainingEvents.Concat(matchEvents).OrderBy(e => e.Date).ToArray();

                var injuries = await db.TeamPlayerInjuries
                    .AsNoTracking()
                    .Where(i => i.TeamPlayerId == teamPlayer.Id && i.StartDate <= nowUtc && (i.EndDate == null || i.EndDate >= rangeStart))
                    .OrderBy(i => i.StartDate)
                    .Select(i => new PhysicalEvolutionInjuryDto(i.StartDate, i.EndDate))
                    .ToArrayAsync(cancellationToken);

                return new PlayerPhysicalEvolutionDto(teamPlayer.Id, request.Days, categoryHalfMinutes is not null, points, events, injuries);
            }
        }
    }
}
