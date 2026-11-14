using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using static RFFM.Api.Features.Coaches.Players.Commands.CreateTeamTraitRatings;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    /// <summary>
    /// Latest weekly behavior trait rating of each player of the team (players never rated are omitted).
    /// GET /api/catalog/team/{teamId}/trait-ratings/latest
    /// </summary>
    public class GetTeamLatestTraitRatings : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/team/{teamId}/trait-ratings/latest",
                    [Authorize(Roles = "Coach,Administrator")] async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new GetTeamLatestTraitRatingsQuery(teamId), cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetTeamLatestTraitRatings))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<IReadOnlyList<TraitRatingResponse>>()
                .Produces(StatusCodes.Status403Forbidden)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record GetTeamLatestTraitRatingsQuery(string TeamId) : RFFM.Api.Common.IQueryApp<IReadOnlyList<TraitRatingResponse>>;

        public class Handler : IRequestHandler<GetTeamLatestTraitRatingsQuery, IReadOnlyList<TraitRatingResponse>>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<IReadOnlyList<TraitRatingResponse>> Handle(GetTeamLatestTraitRatingsQuery request, CancellationToken cancellationToken = default)
            {
                var teamId = await TeamTraitRatingAccess.EnsureCanManageAsync(_db, _currentUser, request.TeamId, cancellationToken);

                var ratings = await _db.TeamPlayerTraitRatings
                    .AsNoTracking()
                    .Include(r => r.Levels)
                    .Where(r => _db.TeamPlayers.Any(tp => tp.Id == r.TeamPlayerId && tp.TeamId == teamId))
                    .OrderByDescending(r => r.RatedAt)
                    .ToListAsync(cancellationToken);

                return ratings
                    .GroupBy(r => r.TeamPlayerId)
                    .Select(g => ToResponse(g.First()))
                    .ToList();
            }
        }
    }
}
