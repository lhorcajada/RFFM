using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using static RFFM.Api.Features.Coaches.MatchReports.LiveMatchReportBuilder;

namespace RFFM.Api.Features.Coaches.MatchReports
{
    public class GetMatchReport : IFeatureModule
    {
        private const int AcceptedConvocationStatusId = 2;

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(
                    "/api/events/{eventId}/match-report",
                    async (string eventId, AppDbContext db, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var teamId = await db.SportEvents.AsNoTracking()
                            .Where(se => se.Id == eventId)
                            .Select(se => se.TeamId)
                            .FirstOrDefaultAsync(cancellationToken);
                        if (teamId is null)
                            throw new NotFoundException("Evento no encontrado", ErrorCodes.EventNotFound);

                        return Results.Ok(await mediator.Send(new MatchReportQuery { EventId = eventId, TeamId = teamId }, cancellationToken));
                    })
                .WithName(nameof(GetMatchReport))
                .WithTags("MatchReports")
                .Produces<MatchReportResponse>()
                .Produces(StatusCodes.Status403Forbidden)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record MatchReportQuery : IQueryApp<MatchReportResponse>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string EventId { get; init; } = null!;
            public string TeamId { get; set; } = null!;

            public string FeatureRoute => CoachFeatureRoutes.Convocations;
            public string RequiredPermission => "Read";
        }

        public record MatchReportResponse(
            string EventId,
            string? TeamName,
            string? TeamPhotoUrl,
            string? RivalName,
            string? RivalPhotoUrl,
            bool IsHomeMatch,
            DateTime? Date,
            string? LocalGoals,
            string? VisitorGoals,
            string? MatchCategory,
            bool HasLiveReport,
            bool HasFederationReport,
            LiveMatchReport? Live);

        public class Handler(AppDbContext db) : IRequestHandler<MatchReportQuery, MatchReportResponse>
        {
            public async ValueTask<MatchReportResponse> Handle(MatchReportQuery request, CancellationToken cancellationToken)
            {
                var sportEvent = await db.SportEvents
                    .AsNoTracking()
                    .Where(se => se.Id == request.EventId)
                    .Select(se => new
                    {
                        se.Id,
                        se.EventTypeId,
                        se.CodActa,
                        se.LocalGoals,
                        se.VisitorGoals,
                        se.IsHomeMatch,
                        se.EveDateTime,
                        se.MatchDurationMinutes,
                        TeamName = se.Team != null ? se.Team.Name : null,
                        TeamPhotoUrl = se.Team != null ? se.Team.UrlPhoto : null,
                        RivalName = se.Rival != null ? se.Rival.Name : null,
                        RivalPhotoUrl = se.Rival != null ? se.Rival.UrlPhoto : null
                    })
                    .SingleOrDefaultAsync(cancellationToken)
                    ?? throw new NotFoundException("Evento no encontrado", ErrorCodes.EventNotFound);

                var participations = await db.MatchParticipations
                    .AsNoTracking()
                    .Where(mp => mp.EventId == request.EventId)
                    .ToListAsync(cancellationToken);

                var hasLiveReport = participations.Any(mp => mp.MatchPhase == MatchReportRules.FinishedPhase);
                var live = hasLiveReport
                    ? await BuildLiveAsync(request.EventId, participations, sportEvent.MatchDurationMinutes, cancellationToken)
                    : null;

                return new MatchReportResponse(
                    sportEvent.Id,
                    sportEvent.TeamName,
                    sportEvent.TeamPhotoUrl,
                    sportEvent.RivalName,
                    sportEvent.RivalPhotoUrl,
                    sportEvent.IsHomeMatch,
                    sportEvent.EveDateTime,
                    sportEvent.LocalGoals,
                    sportEvent.VisitorGoals,
                    MatchReportRules.MatchCategory(sportEvent.EventTypeId),
                    hasLiveReport,
                    MatchReportRules.HasFederationReport(sportEvent.EventTypeId, sportEvent.CodActa, sportEvent.LocalGoals, sportEvent.VisitorGoals),
                    live);
            }

            private async Task<LiveMatchReport> BuildLiveAsync(
                string eventId,
                List<Domain.Entities.TeamPlayers.MatchParticipation> participations,
                int? matchDurationMinutes,
                CancellationToken cancellationToken)
            {
                var first = participations.First();

                var convocatedIds = await db.Convocations
                    .AsNoTracking()
                    .Where(c => c.SportEventId == eventId && c.ConvocationStatusId == AcceptedConvocationStatusId)
                    .Select(c => c.TeamPlayerId)
                    .ToListAsync(cancellationToken);

                var playerIds = participations.Select(p => p.TeamPlayerId).Concat(convocatedIds).Distinct().ToList();
                var players = await db.TeamPlayers
                    .AsNoTracking()
                    .Where(tp => playerIds.Contains(tp.Id))
                    .Select(tp => new
                    {
                        tp.Id,
                        tp.Player.Alias,
                        tp.Player.Name,
                        tp.Player.LastName,
                        tp.Player.UrlPhoto,
                        Dorsal = tp.Dorsal != null ? (int?)tp.Dorsal.Number : null
                    })
                    .ToListAsync(cancellationToken);

                var playerInfos = players.ToDictionary(
                    p => p.Id,
                    p => new PlayerInfo(
                        p.Id,
                        string.IsNullOrWhiteSpace(p.Alias) ? $"{p.Name} {p.LastName}".Trim() : p.Alias,
                        p.Dorsal,
                        p.UrlPhoto));

                var lineup = participations
                    .Select(p => ParseStartingLineup(p.StartingLineupJson))
                    .FirstOrDefault(l => l != null)
                    ?? await LoadEventLineupAsync(eventId, cancellationToken);

                return LiveMatchReportBuilder.Build(
                    playerInfos,
                    participations.Select(p => new ParticipationInfo(p.TeamPlayerId, p.MinutesPlayed, p.IsStarter)).ToList(),
                    convocatedIds,
                    lineup,
                    first.GoalsJson,
                    first.CardsJson,
                    first.SubstitutionWindowsJson,
                    matchDurationMinutes);
            }

            private async Task<StartingLineup?> LoadEventLineupAsync(string eventId, CancellationToken cancellationToken)
            {
                var eventLineup = await db.TeamIdealLineups
                    .AsNoTracking()
                    .Where(l => l.SeasonId == eventId)
                    .Select(l => new
                    {
                        FormationName = l.Formation != null ? l.Formation.Name : null,
                        Slots = l.Slots.Where(s => s.TeamPlayerId != null).Select(s => new { s.SlotIndex, s.TeamPlayerId }).ToList()
                    })
                    .FirstOrDefaultAsync(cancellationToken);

                if (eventLineup is null) return null;

                var slotByPlayer = eventLineup.Slots
                    .GroupBy(s => s.TeamPlayerId!)
                    .ToDictionary(g => g.Key, g => g.First().SlotIndex);
                return new StartingLineup(eventLineup.FormationName, slotByPlayer);
            }
        }
    }
}
