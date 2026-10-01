using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
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
using static RFFM.Api.Features.Coaches.PlayerTracking.GetPlayerObservations;

namespace RFFM.Api.Features.Coaches.PlayerTracking
{
    /// <summary>
    /// Corrige la valoración y el comentario de una observación. Solo cuerpo técnico.
    /// PUT /api/teams/{teamId}/players/{teamPlayerId}/observations/{observationId}
    /// See openspec/changes/player-tracking-edit-delete/design.md → D2.
    /// </summary>
    public class UpdatePlayerObservation : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/teams/{teamId}/players/{teamPlayerId}/observations/{observationId}",
                    async (string teamId, string teamPlayerId, string observationId, Command command, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(
                            command with { TeamId = teamId, TeamPlayerId = teamPlayerId, ObservationId = observationId }, ct)))
                .WithName(nameof(UpdatePlayerObservation))
                .WithTags(PlayerTrackingConstants.Tag)
                .RequireAuthorization(new AuthorizeAttribute { Roles = PlayerTrackingConstants.AllowedRoles })
                .Produces<PlayerObservationDto>()
                .ProducesValidationProblem()
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record Command : RFFM.Api.Common.ICommand<PlayerObservationDto>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; init; } = null!;
            public string TeamPlayerId { get; init; } = null!;
            public string ObservationId { get; init; } = null!;
            public string Assessment { get; init; } = null!;
            public string? Comment { get; init; }
            public IReadOnlyList<string>? Habilidades { get; init; }
            public string FeatureRoute => CoachFeatureRoutes.GameModel;
            public string RequiredPermission => "ReadWrite";
        }

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(c => c.TeamId).NotEmpty();
                RuleFor(c => c.TeamPlayerId).NotEmpty();
                RuleFor(c => c.ObservationId).NotEmpty();
                RuleFor(c => c.Assessment)
                    .Must(a => ObservationAssessment.TryFromName(a, out _))
                    .WithMessage($"La valoración debe ser una de: {string.Join(", ", ObservationAssessment.List.Select(a => a.Name))}.");
                RuleFor(c => c.Comment).MaximumLength(PlayerModelObservation.Rules.CommentMaxLength);
                RuleFor(c => c.Habilidades).ValidHabilidades();
            }
        }

        public class Handler(AppDbContext db) : IRequestHandler<Command, PlayerObservationDto>
        {
            public async ValueTask<PlayerObservationDto> Handle(Command request, CancellationToken cancellationToken)
            {
                await PlayerTrackingGuards.EnsurePlayerInTeamAsync(db, request.TeamId, request.TeamPlayerId, cancellationToken);

                var observation = await PlayerTrackingGuards.FindObservationAsync(
                    db, request.TeamId, request.TeamPlayerId, request.ObservationId, cancellationToken);

                observation.Update(ObservationAssessment.FromName(request.Assessment), request.Comment, request.Habilidades);
                await db.SaveChangesAsync(cancellationToken);

                var trainingSessionName = observation.TrainingSessionId is null
                    ? null
                    : await db.TrainingSessions
                        .AsNoTracking()
                        .Where(s => s.Id == observation.TrainingSessionId)
                        .Select(s => s.Name)
                        .SingleOrDefaultAsync(cancellationToken);

                return ToDto(observation, trainingSessionName);
            }
        }
    }
}
