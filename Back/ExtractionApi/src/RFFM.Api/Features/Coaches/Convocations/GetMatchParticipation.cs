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

namespace RFFM.Api.Features.Coaches.Convocations
{
    public class GetMatchParticipation : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(
                    "/api/events/{eventId}/match-participation",
                    async (string eventId, AppDbContext db, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var sportEvent = await db.SportEvents.AsNoTracking().FirstOrDefaultAsync(se => se.Id == eventId, cancellationToken);
                        if (sportEvent == null) throw new DomainException("Evento", "Evento no encontrado", "EventNotFound");
                        return await mediator.Send(new GetMatchParticipationQuery { EventId = eventId, TeamId = sportEvent.TeamId }, cancellationToken);
                    })
                .WithName(nameof(GetMatchParticipation))
                .WithTags("MatchParticipation")
                .Produces<MatchParticipationResponse>();
        }

        // ─── Query & response ─────────────────────────────────────────────────

        public record GetMatchParticipationQuery : Common.IQueryApp<MatchParticipationResponse?>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string EventId { get; init; } = null!;
            public string TeamId { get; set; } = null!;

            public string FeatureRoute => CoachFeatureRoutes.Convocations;
            public string RequiredPermission => "Read";
        }

        public record MatchParticipationResponse(
            string EventId,
            string TeamId,
            int ScoreLocal,
            int ScoreVisitor,
            string MatchPhase,
            string? SubstitutionWindowsJson,
            string? RatingSnapshotsJson,
            string? GoalsJson,
            string? CardsJson,
            string? FormationChangesJson,
            List<PlayerParticipationRecord> Players);

        public record PlayerParticipationRecord(
            string TeamPlayerId,
            int MinutesPlayed,
            bool IsStarter,
            int? EnteredAtMinute,
            int? ExitedAtMinute);

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler : IRequestHandler<GetMatchParticipationQuery, MatchParticipationResponse?>
        {
            private readonly AppDbContext _db;

            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<MatchParticipationResponse?> Handle(
                GetMatchParticipationQuery request,
                CancellationToken cancellationToken = default)
            {
                var records = await _db.MatchParticipations
                    .AsNoTracking()
                    .Where(mp => mp.EventId == request.EventId)
                    .ToListAsync(cancellationToken);

                if (records.Count == 0) return null;

                var first = records.First();

                return new MatchParticipationResponse(
                    first.EventId,
                    first.TeamId,
                    first.ScoreLocal,
                    first.ScoreVisitor,
                    first.MatchPhase,
                    first.SubstitutionWindowsJson,
                    first.RatingSnapshotsJson,
                    first.GoalsJson,
                    first.CardsJson,
                    first.FormationChangesJson,
                    records.Select(r => new PlayerParticipationRecord(
                        r.TeamPlayerId,
                        r.MinutesPlayed,
                        r.IsStarter,
                        r.EnteredAtMinute,
                        r.ExitedAtMinute
                    )).ToList());
            }
        }
    }
}
