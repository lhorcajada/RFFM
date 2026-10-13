using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Teams;
using RFFM.Api.Infrastructure.Persistence;
using static RFFM.Api.Features.Coaches.Players.Commands.CreateConceptualRating;

namespace RFFM.Api.Features.Coaches.Players.Commands
{
    public class CreateTeamRatingsBatch : IFeatureModule
    {
        public const int MaxRatingsPerBatch = 100;
        public const int MaxNotesLength = 500;

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/catalog/team/{teamId}/ratings",
                    [Authorize(Roles = "Coach,Administrator")] async (string teamId, CreateTeamRatingsBatchRequest req, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new CreateTeamRatingsBatchCommand(teamId, req), cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(CreateTeamRatingsBatch))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<IReadOnlyList<ConceptualRatingResponse>>()
                .Produces(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status403Forbidden)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record RatingAnswerRequest(string CharacteristicKey, string CategoryKey, int Level, string Concept);

        public record PlayerRatingRequest(
            string TeamPlayerId,
            bool IsGoalkeeper,
            IReadOnlyList<RatingAnswerRequest> Answers,
            string? Notes);

        public record CreateTeamRatingsBatchRequest(
            IReadOnlyList<PlayerRatingRequest> Ratings,
            DateTimeOffset? RatedAt = null);

        public record CreateTeamRatingsBatchCommand(string TeamId, CreateTeamRatingsBatchRequest Request)
            : RFFM.Api.Common.ICommand<IReadOnlyList<ConceptualRatingResponse>>;

        public class Validator : AbstractValidator<CreateTeamRatingsBatchCommand>
        {
            public Validator()
            {
                RuleFor(x => x.TeamId).NotEmpty();
                RuleFor(x => x.Request.Ratings)
                    .NotEmpty()
                    .Must(ratings => ratings.Count <= MaxRatingsPerBatch)
                    .WithMessage($"No se pueden guardar más de {MaxRatingsPerBatch} valoraciones a la vez.")
                    .Must(ratings => ratings.Select(r => r.TeamPlayerId).Distinct().Count() == ratings.Count)
                    .WithMessage("Cada jugador solo puede aparecer una vez.");
                RuleForEach(x => x.Request.Ratings).SetValidator(new PlayerRatingValidator());
            }
        }

        private class PlayerRatingValidator : AbstractValidator<PlayerRatingRequest>
        {
            public PlayerRatingValidator()
            {
                RuleFor(x => x.TeamPlayerId).NotEmpty();
                RuleFor(x => x.Notes).MaximumLength(MaxNotesLength);
                RuleFor(x => x.Answers)
                    .NotEmpty()
                    .Must(answers => answers.Select(a => a.CharacteristicKey).Distinct().Count() == answers.Count)
                    .WithMessage("Cada característica solo puede valorarse una vez por jugador.");
                RuleForEach(x => x.Answers).ChildRules(answer =>
                {
                    answer.RuleFor(a => a.CharacteristicKey).NotEmpty();
                    answer.RuleFor(a => a.CategoryKey).NotEmpty();
                    answer.RuleFor(a => a.Concept).NotEmpty();
                    answer.RuleFor(a => a.Level).InclusiveBetween(1, 10);
                });
            }
        }

        public class Handler : IRequestHandler<CreateTeamRatingsBatchCommand, IReadOnlyList<ConceptualRatingResponse>>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<IReadOnlyList<ConceptualRatingResponse>> Handle(CreateTeamRatingsBatchCommand request, CancellationToken cancellationToken = default)
            {
                var team = await _db.Teams
                    .AsNoTracking()
                    .Where(t => t.Id == request.TeamId)
                    .Select(t => new { t.Id, t.ClubId })
                    .FirstOrDefaultAsync(cancellationToken);
                if (team is null)
                    throw new NotFoundException("Equipo no encontrado", "TeamNotFound");

                var isAdministrator = (_currentUser.Roles ?? Enumerable.Empty<string>())
                    .Any(r => r.Equals("Administrator", StringComparison.OrdinalIgnoreCase));
                var canManageTeam = isAdministrator || await TeamEditAuthorization.CanEditAsync(
                    _db, _currentUser.UserId, team.Id, team.ClubId, cancellationToken);
                if (!canManageTeam)
                    throw new ForbiddenAccessException("No tienes permiso para valorar a los jugadores de este equipo.");

                var requestedIds = request.Request.Ratings.Select(r => r.TeamPlayerId).ToList();
                var teamPlayerIds = await _db.TeamPlayers
                    .AsNoTracking()
                    .Where(tp => tp.TeamId == team.Id && requestedIds.Contains(tp.Id))
                    .Select(tp => tp.Id)
                    .ToListAsync(cancellationToken);
                var allPlayersBelongToTeam = teamPlayerIds.Count == requestedIds.Count;
                if (!allPlayersBelongToTeam)
                    throw new DomainException("Valoraciones", "Algún jugador no pertenece a este equipo.", ErrorCodes.RatingPlayerNotInTeam);

                var ratedAt = request.Request.RatedAt ?? DateTimeOffset.UtcNow;
                var ratings = request.Request.Ratings
                    .Select(item => TeamPlayerRating.CreateConceptual(
                        item.TeamPlayerId,
                        item.IsGoalkeeper,
                        item.Answers.Select(a => (a.CharacteristicKey, a.CategoryKey, a.Level, a.Concept)).ToList(),
                        item.Notes,
                        ratedAt))
                    .ToList();

                _db.TeamPlayerRatings.AddRange(ratings);
                await _db.SaveChangesAsync(cancellationToken);

                return ratings.Select(ToResponse).ToList();
            }
        }
    }
}
