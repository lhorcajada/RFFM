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
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using static RFFM.Api.Features.Coaches.PlayerTracking.GetPlayerObservations;

namespace RFFM.Api.Features.Coaches.PlayerTracking
{
    /// <summary>
    /// Registra una observación del modelo de juego sobre un jugador, ligada a un Subprincipio del
    /// modelo del equipo. Solo cuerpo técnico.
    /// POST /api/teams/{teamId}/players/{teamPlayerId}/observations
    /// See openspec/changes/player-tracking-observations-api/design.md → D3.
    /// </summary>
    public class CreatePlayerObservation : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/teams/{teamId}/players/{teamPlayerId}/observations",
                    async (string teamId, string teamPlayerId, Command command, IMediator mediator, CancellationToken ct) =>
                    {
                        var result = await mediator.Send(command with { TeamId = teamId, TeamPlayerId = teamPlayerId }, ct);
                        return Results.Created($"/api/teams/{teamId}/players/{teamPlayerId}/observations/{result.Id}", result);
                    })
                .WithName(nameof(CreatePlayerObservation))
                .WithTags(PlayerTrackingConstants.Tag)
                .RequireAuthorization()
                .Produces<PlayerObservationDto>(StatusCodes.Status201Created)
                .ProducesValidationProblem()
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record Command : RFFM.Api.Common.ICommand<PlayerObservationDto>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; init; } = null!;
            public string TeamPlayerId { get; init; } = null!;
            public DateOnly Date { get; init; }
            public string Kind { get; init; } = ObservationKind.GameModel.Name;
            public string? SubprincipioId { get; init; }
            public string? AttitudeKey { get; init; }
            public IReadOnlyList<string>? Habilidades { get; init; }
            public string Assessment { get; init; } = null!;
            public string? Comment { get; init; }
            public string? TrainingSessionId { get; init; }
            public string FeatureRoute => CoachFeatureRoutes.GameModel;
            public string RequiredPermission => "ReadWrite";
        }

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(c => c.TeamId).NotEmpty();
                RuleFor(c => c.TeamPlayerId).NotEmpty();
                RuleFor(c => c.Kind)
                    .Must(k => ObservationKind.TryFromName(k, out _))
                    .WithMessage($"El tipo debe ser uno de: {string.Join(", ", ObservationKind.List.Select(k => k.Name))}.");
                When(c => c.Kind == ObservationKind.GameModel.Name, () =>
                {
                    RuleFor(c => c.SubprincipioId).NotEmpty();
                    RuleFor(c => c.AttitudeKey).Empty().WithMessage("Una observación del modelo de juego no lleva rasgo de actitud.");
                    RuleFor(c => c.Habilidades).ValidHabilidades();
                });
                When(c => c.Kind == ObservationKind.Attitude.Name, () =>
                {
                    RuleFor(c => c.AttitudeKey)
                        .Must(AttitudeTraits.IsKnown)
                        .WithMessage($"El rasgo de actitud debe ser uno de: {string.Join(", ", AttitudeTraits.All.Select(t => t.Key))}.");
                    RuleFor(c => c.SubprincipioId).Empty().WithMessage("Una observación de actitud no lleva subprincipio.");
                    RuleFor(c => c.Habilidades)
                        .Must(h => h is null || h.Count == 0)
                        .WithMessage("Una observación de actitud no lleva habilidades.");
                });
                RuleFor(c => c.Date)
                    .Must(date => date <= DateOnly.FromDateTime(DateTime.UtcNow))
                    .WithMessage("La fecha de la observación no puede ser futura.");
                RuleFor(c => c.Assessment)
                    .Must(a => ObservationAssessment.TryFromName(a, out _))
                    .WithMessage($"La valoración debe ser una de: {string.Join(", ", ObservationAssessment.List.Select(a => a.Name))}.");
                RuleFor(c => c.Comment).MaximumLength(PlayerModelObservation.Rules.CommentMaxLength);
            }
        }

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<Command, PlayerObservationDto>
        {
            public async ValueTask<PlayerObservationDto> Handle(Command request, CancellationToken cancellationToken)
            {
                await PlayerTrackingGuards.EnsurePlayerInTeamAsync(db, request.TeamId, request.TeamPlayerId, cancellationToken);

                var trainingSessionName = await TrainingSessionNameAsync(request, cancellationToken);
                var createdBy = currentUser.UserId ?? throw new UnauthorizedAccessException();
                var assessment = ObservationAssessment.FromName(request.Assessment);

                var observation = request.Kind == ObservationKind.Attitude.Name
                    ? PlayerModelObservation.ForAttitude(
                        request.TeamPlayerId, request.TeamId, request.Date, request.AttitudeKey!, assessment,
                        request.Comment, createdBy, request.TrainingSessionId)
                    : PlayerModelObservation.ForGameModel(
                        request.TeamPlayerId, request.TeamId, request.Date,
                        await SubprincipioSnapshotAsync(request, cancellationToken), assessment,
                        request.Comment, createdBy, request.TrainingSessionId, request.Habilidades);

                db.PlayerModelObservations.Add(observation);
                await db.SaveChangesAsync(cancellationToken);

                return ToDto(observation, trainingSessionName);
            }

            private async Task<SubprincipioSnapshot> SubprincipioSnapshotAsync(Command request, CancellationToken cancellationToken)
            {
                var subprincipio = await db.Subprincipios
                    .AsNoTracking()
                    .Where(sp => sp.Id == request.SubprincipioId && sp.GamePrinciple.GameModel.TeamId == request.TeamId)
                    .Select(sp => new
                    {
                        sp.Id,
                        sp.Numero,
                        sp.Titulo,
                        PrincipleNumero = sp.GamePrinciple.Numero,
                        PrincipleTitulo = sp.GamePrinciple.Titulo,
                        MomentName = sp.GamePrinciple.GameMoment.Name
                    })
                    .SingleOrDefaultAsync(cancellationToken)
                    ?? throw new NotFoundException($"Subprincipio '{request.SubprincipioId}' Not Found", ErrorCodes.SubprincipioNotFound);

                return new SubprincipioSnapshot(
                    subprincipio.Id,
                    subprincipio.MomentName,
                    $"{subprincipio.PrincipleNumero}. {subprincipio.PrincipleTitulo}",
                    $"{subprincipio.Numero} {subprincipio.Titulo}");
            }

            private async Task<string?> TrainingSessionNameAsync(Command request, CancellationToken cancellationToken)
            {
                if (string.IsNullOrWhiteSpace(request.TrainingSessionId))
                    return null;

                var session = await db.TrainingSessions
                    .AsNoTracking()
                    .Where(s => s.Id == request.TrainingSessionId && s.TeamId == request.TeamId)
                    .Select(s => new { s.Name })
                    .SingleOrDefaultAsync(cancellationToken);

                return session?.Name
                    ?? throw new NotFoundException($"TrainingSession '{request.TrainingSessionId}' Not Found", ErrorCodes.SessionNotFound);
            }
        }
    }
}
