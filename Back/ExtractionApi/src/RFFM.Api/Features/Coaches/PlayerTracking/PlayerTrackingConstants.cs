using FluentValidation;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.PlayerTracking
{
    public static class PlayerTrackingConstants
    {
        public const string Tag = "PlayerTracking";
    }

    internal static class PlayerTrackingGuards
    {
        public static async Task EnsurePlayerInTeamAsync(AppDbContext db, string teamId, string teamPlayerId, CancellationToken cancellationToken)
        {
            var playerInTeam = await db.TeamPlayers
                .AsNoTracking()
                .AnyAsync(tp => tp.Id == teamPlayerId && tp.TeamId == teamId, cancellationToken);

            if (!playerInTeam)
                throw new NotFoundException($"TeamPlayer '{teamPlayerId}' Not Found", ErrorCodes.TeamPlayerNotFound);
        }

        public static async Task<PlayerModelObservation> FindObservationAsync(
            AppDbContext db, string teamId, string teamPlayerId, string observationId, CancellationToken cancellationToken)
        {
            return await db.PlayerModelObservations
                .SingleOrDefaultAsync(o => o.Id == observationId && o.TeamPlayerId == teamPlayerId && o.TeamId == teamId, cancellationToken)
                ?? throw new NotFoundException($"PlayerObservation '{observationId}' Not Found", ErrorCodes.PlayerObservationNotFound);
        }
    }

    internal static class PlayerTrackingValidationRules
    {
        /// <summary>Habilidades del vocabulario cerrado, sin repetir y como mucho <see cref="PlayerModelObservation.Rules.MaxHabilidades"/>.</summary>
        public static IRuleBuilderOptions<T, IReadOnlyList<string>?> ValidHabilidades<T>(this IRuleBuilder<T, IReadOnlyList<string>?> rule) =>
            rule
                .Must(h => h is null || h.Count <= PlayerModelObservation.Rules.MaxHabilidades)
                .WithMessage($"Como mucho {PlayerModelObservation.Rules.MaxHabilidades} habilidades.")
                .Must(h => h is null || h.Distinct().Count() == h.Count)
                .WithMessage("Las habilidades no se pueden repetir.")
                .Must(h => h is null || h.All(Habilidad.Vocabulary.Contains))
                .WithMessage("Alguna habilidad no pertenece al vocabulario del modelo de juego.");
    }
}
