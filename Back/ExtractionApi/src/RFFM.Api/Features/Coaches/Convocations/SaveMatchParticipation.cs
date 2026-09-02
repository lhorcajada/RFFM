using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.FeatureModules;
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

                await _db.SaveChangesAsync(cancellationToken);
                return Unit.Value;
            }
        }
    }
}
