using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.PositionFit;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    /// <summary>
    /// Candidates of each unified position ordered by fit (or by the latest order confirmed by the coach).
    /// GET /api/catalog/team/{teamId}/position-fit
    /// </summary>
    public class GetTeamPositionFit : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/team/{teamId}/position-fit",
                    [Authorize(Roles = "Coach,Administrator")] async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new GetTeamPositionFitQuery(teamId), cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetTeamPositionFit))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<IReadOnlyList<PositionFitResponse>>()
                .Produces(StatusCodes.Status403Forbidden)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record PositionFitCandidateResponse(string TeamPlayerId, string Name, int Place, decimal? Fit, string Trend);

        public record PositionFitResponse(
            string Position,
            DateTime? ConfirmedWeekStart,
            bool IsManual,
            IReadOnlyList<PositionFitCandidateResponse> Candidates,
            IReadOnlyDictionary<string, string> Weights);

        public record GetTeamPositionFitQuery(string TeamId) : RFFM.Api.Common.IQueryApp<IReadOnlyList<PositionFitResponse>>;

        private record PlayerRow(string Id, string Name, int? ActivePositionId, IEnumerable<int>? PossibleDemarcationIds);

        /// <summary>
        /// Builds the fit of every evaluated position for the team. With <paramref name="useConfirmedOrder"/> false only
        /// the proposed order (by fit) is returned.
        /// </summary>
        public static async Task<IReadOnlyList<PositionFitResponse>> BuildAsync(
            AppDbContext db,
            string teamId,
            bool useConfirmedOrder,
            CancellationToken cancellationToken)
        {
            var rows = (await db.TeamPlayers
                    .AsNoTracking()
                    .Where(tp => tp.TeamId == teamId && tp.LeftDate == null)
                    .Select(tp => new
                    {
                        tp.Id,
                        tp.Player.Alias,
                        tp.Player.Name,
                        tp.Player.LastName,
                        ActivePositionId = tp.Demarcation != null ? (int?)tp.Demarcation.ActivePositionId : null,
                        PossibleDemarcationIds = tp.Demarcation != null ? tp.Demarcation.PossibleDemarcationIds : null,
                    })
                    .ToListAsync(cancellationToken))
                .Select(r => new PlayerRow(
                    r.Id,
                    !string.IsNullOrWhiteSpace(r.Alias) ? r.Alias!.Trim() : $"{r.Name} {r.LastName}".Trim(),
                    r.ActivePositionId,
                    r.PossibleDemarcationIds))
                .ToList();

            var playerIds = rows.Select(r => r.Id).ToList();
            var latestByPlayer = (await db.TeamPlayerTraitRatings
                    .AsNoTracking()
                    .Include(r => r.Levels)
                    .Where(r => playerIds.Contains(r.TeamPlayerId))
                    .OrderByDescending(r => r.RatedAt)
                    .ToListAsync(cancellationToken))
                .GroupBy(r => r.TeamPlayerId)
                .ToDictionary(g => g.Key, g => g.First());

            var overrides = await db.TeamTraitWeights
                .AsNoTracking()
                .Where(w => w.TeamId == teamId)
                .ToListAsync(cancellationToken);

            var confirmedByPosition = new Dictionary<int, TeamPositionFitOrder>();
            if (useConfirmedOrder)
            {
                var orders = await db.TeamPositionFitOrders
                    .AsNoTracking()
                    .Include(o => o.Entries)
                    .Where(o => o.TeamId == teamId)
                    .OrderByDescending(o => o.WeekStart)
                    .ToListAsync(cancellationToken);
                foreach (var order in orders)
                    confirmedByPosition.TryAdd(order.Position, order);
            }

            var responses = new List<PositionFitResponse>();
            foreach (var position in FitPositionKeys.Evaluated)
            {
                var weights = ResolveWeights(position, overrides);
                var candidates = rows
                    .Where(r => FitPositionMap.CandidatePositions(r.ActivePositionId, r.PossibleDemarcationIds).Contains(position))
                    .Select(r =>
                    {
                        latestByPlayer.TryGetValue(r.Id, out var rating);
                        var levels = rating?.Levels.ToDictionary(l => l.TraitKey, l => l.Level)
                                     ?? new Dictionary<string, int>();
                        return new FitCandidate(r.Id, r.Name, PositionFitCalculator.Calculate(levels, weights), rating?.Trend ?? TraitTrend.Same);
                    })
                    .ToList();

                var ordered = PositionFitOrdering.Propose(candidates);
                confirmedByPosition.TryGetValue((int)position, out var confirmed);
                if (confirmed is not null)
                    ordered = PositionFitOrdering.ApplyConfirmedOrder(
                        ordered,
                        confirmed.Entries.OrderBy(e => e.Place).Select(e => e.TeamPlayerId).ToList());

                responses.Add(new PositionFitResponse(
                    FitPositionKeys.ToKey(position),
                    confirmed?.WeekStart,
                    confirmed?.IsManual ?? false,
                    ordered
                        .Select((c, index) => new PositionFitCandidateResponse(c.TeamPlayerId, c.Name, index + 1, c.Fit, c.Trend))
                        .ToList(),
                    weights.ToDictionary(w => w.Key, w => TraitWeightKeys.ToKey(w.Value))));
            }

            return responses;
        }

        private static Dictionary<string, TraitWeight> ResolveWeights(FitPosition position, IReadOnlyList<TeamTraitWeight> overrides)
        {
            var weights = DefaultTraitWeights.For(position).ToDictionary(w => w.Key, w => w.Value);
            foreach (var teamOverride in overrides.Where(o => o.Position == (int)position))
            {
                var weight = TraitWeightKeys.TryParse(teamOverride.Weight);
                if (weight.HasValue && weights.ContainsKey(teamOverride.TraitKey))
                    weights[teamOverride.TraitKey] = weight.Value;
            }

            return weights;
        }

        public class Handler : IRequestHandler<GetTeamPositionFitQuery, IReadOnlyList<PositionFitResponse>>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<IReadOnlyList<PositionFitResponse>> Handle(GetTeamPositionFitQuery request, CancellationToken cancellationToken = default)
            {
                var teamId = await TeamTraitRatingAccess.EnsureCanManageAsync(_db, _currentUser, request.TeamId, cancellationToken);
                return await BuildAsync(_db, teamId, useConfirmedOrder: true, cancellationToken);
            }
        }
    }
}
