using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.PlayerTracking
{
    /// <summary>
    /// Observaciones del modelo de juego de un jugador, la más reciente primero. Solo cuerpo técnico.
    /// GET /api/teams/{teamId}/players/{teamPlayerId}/observations
    /// See openspec/changes/player-tracking-observations-api/design.md → D3.
    /// </summary>
    public class GetPlayerObservations : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/teams/{teamId}/players/{teamPlayerId}/observations",
                    async (string teamId, string teamPlayerId, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Query { TeamId = teamId, TeamPlayerId = teamPlayerId }, ct)))
                .WithName(nameof(GetPlayerObservations))
                .WithTags(PlayerTrackingConstants.Tag)
                .RequireAuthorization()
                .Produces<PlayerObservationDto[]>()
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record Query : IQueryApp<PlayerObservationDto[]>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; init; } = null!;
            public string TeamPlayerId { get; init; } = null!;
            public string FeatureRoute => CoachFeatureRoutes.GameModel;
            public string RequiredPermission => "Read";
        }

        public class Validator : AbstractValidator<Query>
        {
            public Validator()
            {
                RuleFor(q => q.TeamId).NotEmpty();
                RuleFor(q => q.TeamPlayerId).NotEmpty();
            }
        }

        public record PlayerObservationDto(
            string Id,
            DateOnly Date,
            string Kind,
            string? SubprincipioId,
            string? MomentName,
            string? PrincipleLabel,
            string? SubprincipioLabel,
            string Assessment,
            string? Comment,
            DateTime CreatedAt,
            string? TrainingSessionId,
            string? TrainingSessionName,
            string? AttitudeKey,
            string? AttitudeLabel,
            IReadOnlyList<string> Habilidades);

        internal static PlayerObservationDto ToDto(PlayerModelObservation o, string? trainingSessionName) =>
            new(o.Id, o.Date, o.Kind.Name, o.SubprincipioId, o.MomentName, o.PrincipleLabel, o.SubprincipioLabel,
                o.Assessment.Name, o.Comment, o.CreatedAt, o.TrainingSessionId, trainingSessionName,
                o.AttitudeKey, o.AttitudeKey is null ? null : AttitudeTraits.LabelOf(o.AttitudeKey), o.Habilidades.ToList());

        public class Handler(AppDbContext db) : IRequestHandler<Query, PlayerObservationDto[]>
        {
            public async ValueTask<PlayerObservationDto[]> Handle(Query request, CancellationToken cancellationToken)
            {
                await PlayerTrackingGuards.EnsurePlayerInTeamAsync(db, request.TeamId, request.TeamPlayerId, cancellationToken);

                var observations = await (
                        from o in db.PlayerModelObservations.AsNoTracking()
                        where o.TeamPlayerId == request.TeamPlayerId
                        join s in db.TrainingSessions.AsNoTracking() on o.TrainingSessionId equals s.Id into sessions
                        from s in sessions.DefaultIfEmpty()
                        orderby o.Date descending, o.CreatedAt descending
                        select new { Observation = o, SessionName = s != null ? s.Name : null })
                    .ToListAsync(cancellationToken);

                return observations.Select(x => ToDto(x.Observation, x.SessionName)).ToArray();
            }
        }
    }
}
