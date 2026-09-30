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
            public string SubprincipioId { get; init; } = null!;
            public string Assessment { get; init; } = null!;
            public string? Comment { get; init; }
            public string FeatureRoute => CoachFeatureRoutes.GameModel;
            public string RequiredPermission => "ReadWrite";
        }

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(c => c.TeamId).NotEmpty();
                RuleFor(c => c.TeamPlayerId).NotEmpty();
                RuleFor(c => c.SubprincipioId).NotEmpty();
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

                var observation = PlayerModelObservation.ForGameModel(
                    request.TeamPlayerId,
                    request.TeamId,
                    request.Date,
                    new SubprincipioSnapshot(
                        subprincipio.Id,
                        subprincipio.MomentName,
                        $"{subprincipio.PrincipleNumero}. {subprincipio.PrincipleTitulo}",
                        $"{subprincipio.Numero} {subprincipio.Titulo}"),
                    ObservationAssessment.FromName(request.Assessment),
                    request.Comment,
                    currentUser.UserId ?? throw new UnauthorizedAccessException());

                db.PlayerModelObservations.Add(observation);
                await db.SaveChangesAsync(cancellationToken);

                return ToDto(observation);
            }
        }
    }
}
