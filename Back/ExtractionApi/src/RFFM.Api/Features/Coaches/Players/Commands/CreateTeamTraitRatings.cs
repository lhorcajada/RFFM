using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.PositionFit;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Commands
{
    /// <summary>
    /// Creates a batch of weekly behavior trait ratings (atomically). Previous ratings are never modified.
    /// POST /api/catalog/team/{teamId}/trait-ratings
    /// </summary>
    public class CreateTeamTraitRatings : IFeatureModule
    {
        public const int MaxRatingsPerBatch = 100;

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/catalog/team/{teamId}/trait-ratings",
                    [Authorize(Roles = "Coach,Administrator")] async (string teamId, CreateTeamTraitRatingsRequest req, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new CreateTeamTraitRatingsCommand(teamId, req), cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(CreateTeamTraitRatings))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<IReadOnlyList<TraitRatingResponse>>()
                .Produces(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status403Forbidden)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record TraitLevelRequest(string TraitKey, int Level);

        public record PlayerTraitRatingRequest(
            string TeamPlayerId,
            IReadOnlyList<TraitLevelRequest> Levels,
            string? Trend);

        public record CreateTeamTraitRatingsRequest(
            IReadOnlyList<PlayerTraitRatingRequest> Ratings,
            DateTimeOffset? RatedAt = null);

        public record TraitLevelResponse(string TraitKey, int Level);

        public record TraitRatingResponse(
            string Id,
            string TeamPlayerId,
            DateTime RatedAt,
            string Trend,
            IReadOnlyList<TraitLevelResponse> Levels);

        public record CreateTeamTraitRatingsCommand(string TeamId, CreateTeamTraitRatingsRequest Request)
            : RFFM.Api.Common.ICommand<IReadOnlyList<TraitRatingResponse>>;

        public static TraitRatingResponse ToResponse(TeamPlayerTraitRating rating) => new(
            rating.Id,
            rating.TeamPlayerId,
            DateTime.SpecifyKind(rating.RatedAt, DateTimeKind.Utc),
            rating.Trend,
            rating.Levels.Select(l => new TraitLevelResponse(l.TraitKey, l.Level)).ToList());

        public class Validator : AbstractValidator<CreateTeamTraitRatingsCommand>
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
                RuleForEach(x => x.Request.Ratings).SetValidator(new PlayerTraitRatingValidator());
            }
        }

        private class PlayerTraitRatingValidator : AbstractValidator<PlayerTraitRatingRequest>
        {
            public PlayerTraitRatingValidator()
            {
                RuleFor(x => x.TeamPlayerId).NotEmpty();
                RuleFor(x => x.Trend)
                    .Must(trend => trend is null || TraitTrend.IsValid(trend))
                    .WithMessage("La tendencia debe ser up, same o down.");
                RuleFor(x => x.Levels)
                    .NotNull()
                    .Must(levels => levels.Select(l => l.TraitKey).Distinct().Count() == levels.Count)
                    .WithMessage("Cada rasgo solo puede valorarse una vez por jugador.");
                RuleForEach(x => x.Levels).ChildRules(level =>
                {
                    level.RuleFor(l => l.TraitKey)
                        .Must(TraitCatalog.IsKnown)
                        .WithMessage("El rasgo indicado no existe.");
                    level.RuleFor(l => l.Level)
                        .InclusiveBetween(TraitCatalog.MinLevel, TraitCatalog.MaxLevel);
                });
            }
        }

        public class Handler : IRequestHandler<CreateTeamTraitRatingsCommand, IReadOnlyList<TraitRatingResponse>>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<IReadOnlyList<TraitRatingResponse>> Handle(CreateTeamTraitRatingsCommand request, CancellationToken cancellationToken = default)
            {
                var teamId = await TeamTraitRatingAccess.EnsureCanManageAsync(_db, _currentUser, request.TeamId, cancellationToken);

                var requestedIds = request.Request.Ratings.Select(r => r.TeamPlayerId).ToList();
                var teamPlayerIds = await _db.TeamPlayers
                    .AsNoTracking()
                    .Where(tp => tp.TeamId == teamId && requestedIds.Contains(tp.Id))
                    .Select(tp => tp.Id)
                    .ToListAsync(cancellationToken);
                var allPlayersBelongToTeam = teamPlayerIds.Count == requestedIds.Count;
                if (!allPlayersBelongToTeam)
                    throw new DomainException("Valoraciones", "Algún jugador no pertenece a este equipo.", ErrorCodes.RatingPlayerNotInTeam);

                var ratedAt = request.Request.RatedAt ?? DateTimeOffset.UtcNow;
                var ratings = request.Request.Ratings
                    .Select(item => TeamPlayerTraitRating.Create(
                        item.TeamPlayerId,
                        item.Levels.Select(l => (l.TraitKey, l.Level)).ToList(),
                        item.Trend,
                        ratedAt))
                    .ToList();

                _db.TeamPlayerTraitRatings.AddRange(ratings);
                await _db.SaveChangesAsync(cancellationToken);

                return ratings.Select(ToResponse).ToList();
            }
        }
    }
}
