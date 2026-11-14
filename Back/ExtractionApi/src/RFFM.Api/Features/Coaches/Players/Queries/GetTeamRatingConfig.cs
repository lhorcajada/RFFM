using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    /// <summary>
    /// Team customizations of capacities and traits (edited, hidden or created). Defaults the team never touched are
    /// not returned: the client combines these rows with the default texts it owns.
    /// GET /api/catalog/team/{teamId}/rating-config
    /// </summary>
    public class GetTeamRatingConfig : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/team/{teamId}/rating-config",
                    [Authorize(Roles = "Coach,Administrator")] async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new GetTeamRatingConfigQuery(teamId), cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetTeamRatingConfig))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<RatingConfigResponse>()
                .Produces(StatusCodes.Status403Forbidden)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record TraitConfigResponse(
            string Key,
            bool IsCustom,
            bool IsHidden,
            string? Label,
            string? Phase,
            string? Anchor1,
            string? Anchor3,
            string? Anchor5);

        public record CapacityConfigResponse(
            string Key,
            bool IsCustom,
            bool IsHidden,
            string Sheet,
            string CategoryKey,
            string? Label,
            IReadOnlyList<string>? LevelTexts);

        public record RatingConfigResponse(
            IReadOnlyList<CapacityConfigResponse> Capacities,
            IReadOnlyList<TraitConfigResponse> Traits);

        public record GetTeamRatingConfigQuery(string TeamId) : RFFM.Api.Common.IQueryApp<RatingConfigResponse>;

        public static TraitConfigResponse ToResponse(TeamTraitDefinition trait) => new(
            trait.Key, trait.IsCustom, trait.IsHidden, trait.Label, trait.Phase, trait.Anchor1, trait.Anchor3, trait.Anchor5);

        public static CapacityConfigResponse ToResponse(TeamCapacityDefinition capacity) => new(
            capacity.Key, capacity.IsCustom, capacity.IsHidden, capacity.Sheet, capacity.CategoryKey, capacity.Label, capacity.LevelTexts);

        public class Handler : IRequestHandler<GetTeamRatingConfigQuery, RatingConfigResponse>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<RatingConfigResponse> Handle(GetTeamRatingConfigQuery request, CancellationToken cancellationToken = default)
            {
                var teamId = await TeamTraitRatingAccess.EnsureCanManageAsync(_db, _currentUser, request.TeamId, cancellationToken);

                var capacities = await _db.TeamCapacityDefinitions
                    .AsNoTracking()
                    .Where(c => c.TeamId == teamId)
                    .OrderBy(c => c.Key)
                    .ToListAsync(cancellationToken);
                var traits = await _db.TeamTraitDefinitions
                    .AsNoTracking()
                    .Where(t => t.TeamId == teamId)
                    .OrderBy(t => t.Key)
                    .ToListAsync(cancellationToken);

                return new RatingConfigResponse(
                    capacities.Select(ToResponse).ToList(),
                    traits.Select(ToResponse).ToList());
            }
        }
    }
}
