using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Assistances.Queries
{
    /// <summary>
    /// Returns per-player training attendance aggregates for a team.
    /// </summary>
    public class GetTrainingAttendanceSummary : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(
                    "/api/attendance/training-summary/{teamId}",
                    [Authorize] async (
                        string teamId,
                        string? seasonId,
                        IMediator mediator,
                        CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(
                            new Query { TeamId = teamId, SeasonId = seasonId },
                            cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetTrainingAttendanceSummary))
                .WithTags("Assistances")
                .Produces<Response>();
        }

        public record Query : Common.IQueryApp<Response>, IRequireFeaturePermission
        {
            public string TeamId { get; init; } = null!;
            public string? SeasonId { get; init; }

            public string FeatureRoute => CoachFeatureRoutes.AttendanceSummary;
            public string RequiredPermission => "Read";
        }

        public record Response(int TotalTrainingEvents, PlayerRow[] Players);

        public record PlayerRow(
            string TeamPlayerId,
            string? PlayerId,
            string PlayerName,
            int TotalTrainings,
            int AttendedTrainings,
            int AbsentTrainings,
            AbsenceDetail[] Absences);

        public record AbsenceDetail(
            string EventId,
            string EventTitle,
            DateTime? Date,
            int? AssistanceTypeId,
            int? ExcuseTypeId,
            string Reason);

        private record TrainingEventProjection(string Id, string Name, DateTime EveDateTime);
        private record PlayerProjection(string Id, string? PlayerId, string Alias, string Name, string? LastName);
        private record ConvocationProjection(string TeamPlayerId, string SportEventId, int? AssistanceTypeId, int? ExcuseTypeId, int? ConvocationStatusId);

        public class Handler : IRequestHandler<Query, Response>
        {
            private readonly AppDbContext _db;

            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<Response> Handle(Query request, CancellationToken cancellationToken = default)
            {
                // SportEvent currently has no SeasonId FK in schema.
                // Season filtering can be applied here once SportEvent.SeasonId exists.
                _ = request.SeasonId;

                var trainingEvents = await _db.SportEvents
                    .AsNoTracking()
                    .Where(e => e.TeamId == request.TeamId && e.EventTypeId == SportEventType.FromName("Entrenamiento").Id)
                    .Select(e => new TrainingEventProjection(e.Id, e.Name, e.EveDateTime))
                    .ToListAsync(cancellationToken);

                var totalTrainingEvents = trainingEvents.Count;
                var trainingEventIds = trainingEvents.Select(e => e.Id).ToList();

                var players = await _db.TeamPlayers
                    .AsNoTracking()
                    .Include(tp => tp.Player)
                    .Where(tp => tp.TeamId == request.TeamId)
                    .Select(tp => new PlayerProjection(
                        tp.Id,
                        tp.PlayerId,
                        tp.Player.Alias,
                        tp.Player.Name,
                        tp.Player.LastName))
                    .ToListAsync(cancellationToken);

                var convocations = await _db.Convocations
                    .AsNoTracking()
                    .Where(c => trainingEventIds.Contains(c.SportEventId))
                    .Select(c => new ConvocationProjection(
                        c.TeamPlayerId,
                        c.SportEventId,
                        c.AssistanceTypeId,
                        c.ExcuseTypeId,
                        c.ConvocationStatusId))
                    .ToListAsync(cancellationToken);

                var eventMap = trainingEvents.ToDictionary(e => e.Id, e => e);
                var assistanceReasonMap = AssistanceType.List().ToDictionary(a => a.Id, a => a.Name);
                var excuseReasonMap = ExcuseTypes.List().ToDictionary(e => e.Id, e => e.Name);
                var justifiedStatusId = ConvocationStatus.FromName("Justified").Id;
                var deconvokeStatusId = ConvocationStatus.FromName("Deconvoke").Id;

                var byPlayer = convocations
                    .GroupBy(c => c.TeamPlayerId)
                    .ToDictionary(g => g.Key, g => g.ToList());

                var rows = new List<PlayerRow>(players.Count);
                foreach (var player in players)
                {
                    byPlayer.TryGetValue(player.Id, out var playerConvocations);
                    playerConvocations ??= new List<ConvocationProjection>();

                    var attended = playerConvocations.Count(c => c.AssistanceTypeId == AssistanceType.Attendance.Id || c.AssistanceTypeId == AssistanceType.LateArrival.Id);

                    // A convocation counts as absent when:
                    // (a) the coach explicitly marked absence (AssistanceTypeId = 2 or 3), OR
                    // (b) the player was justified or deconvoked (status ids from the domain model)
                    //     and the coach never overrode it with an AssistanceType.
                    var absentConvs = playerConvocations
                        .Where(c =>
                            c.AssistanceTypeId == AssistanceType.ExcusedAbsence.Id ||
                            c.AssistanceTypeId == AssistanceType.UnexcusedAbsence.Id ||
                            (c.AssistanceTypeId == null && (c.ConvocationStatusId == justifiedStatusId || c.ConvocationStatusId == deconvokeStatusId)))
                        .ToList();

                    var absent = absentConvs.Count;

                    // "Total possible trainings" for this player: trainings where a real outcome
                    // is known (attended or absent), not every training the team ever scheduled —
                    // trainings with no recorded outcome (never convoked, or still pending) don't
                    // count toward the denominator of the player's attendance rate.
                    var totalPossibleTrainings = attended + absent;

                    var absences = absentConvs
                        .Select(c =>
                        {
                            eventMap.TryGetValue(c.SportEventId, out var ev);
                            var reason = c.ExcuseTypeId != null && excuseReasonMap.TryGetValue(c.ExcuseTypeId.Value, out var excuseName)
                                ? excuseName
                                : (c.AssistanceTypeId != null && assistanceReasonMap.TryGetValue(c.AssistanceTypeId.Value, out var assistanceName)
                                    ? assistanceName
                                    : c.ConvocationStatusId == deconvokeStatusId ? "Desconvocado"
                                    : c.ConvocationStatusId == justifiedStatusId ? "Justificado"
                                    : "No informado");

                            return new AbsenceDetail(
                                c.SportEventId,
                                ev?.Name ?? "Entrenamiento",
                                ev?.EveDateTime,
                                c.AssistanceTypeId,
                                c.ExcuseTypeId,
                                reason);
                        })
                        .OrderByDescending(a => a.Date)
                        .ToArray();

                    var displayName = !string.IsNullOrWhiteSpace(player.Alias)
                        ? player.Alias
                        : string.Join(" ", new[] { player.Name, player.LastName }.Where(s => !string.IsNullOrWhiteSpace(s))).Trim();

                    rows.Add(new PlayerRow(
                        player.Id,
                        player.PlayerId,
                        string.IsNullOrWhiteSpace(displayName) ? "Jugador" : displayName,
                        totalPossibleTrainings,
                        attended,
                        absent,
                        absences));
                }

                var orderedRows = rows
                    .OrderByDescending(r => r.AbsentTrainings)
                    .ThenByDescending(r => r.AttendedTrainings)
                    .ThenBy(r => r.PlayerName)
                    .ToArray();

                return new Response(totalTrainingEvents, orderedRows);
            }
        }
    }
}
