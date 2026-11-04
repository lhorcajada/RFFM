using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
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
            /// <summary>Duración real del partido; solo se aplica con MatchPhase "finished". null = no cambia la guardada.</summary>
            public int? MatchDurationMinutes { get; init; }
            /// <summary>Alineación inicial serializada; null = no cambia la guardada.</summary>
            public string? StartingLineupJson { get; init; }
        }

        public const int MaxMatchDurationMinutes = 200;

        public class Validator : AbstractValidator<SaveMatchParticipationRequest>
        {
            public Validator()
            {
                RuleFor(x => x.MatchDurationMinutes)
                    .InclusiveBetween(0, MaxMatchDurationMinutes)
                    .When(x => x.MatchDurationMinutes is not null);
            }
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
                await new MatchParticipationWriter(_db).SaveAsync(request, cancellationToken);
                return Unit.Value;
            }
        }
    }
}
