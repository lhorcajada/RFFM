using RFFM.Api.Domain.Entities.TeamPlayers;

namespace RFFM.Api.Domain.PositionFit
{
    public record FitCandidate(string TeamPlayerId, string Name, decimal? Fit, string Trend);

    public static class PositionFitOrdering
    {
        private static int TrendRank(string trend) => trend switch
        {
            TraitTrend.Up => 0,
            TraitTrend.Down => 2,
            _ => 1,
        };

        /// <summary>
        /// Proposed order: highest fit first, then trend (up, same, down), then name. Candidates without fit go last.
        /// </summary>
        public static IReadOnlyList<FitCandidate> Propose(IEnumerable<FitCandidate> candidates) =>
            candidates
                .OrderBy(c => c.Fit.HasValue ? 0 : 1)
                .ThenByDescending(c => c.Fit ?? 0m)
                .ThenBy(c => TrendRank(c.Trend))
                .ThenBy(c => c.Name, StringComparer.CurrentCultureIgnoreCase)
                .ThenBy(c => c.TeamPlayerId, StringComparer.Ordinal)
                .ToList();

        /// <summary>
        /// The confirmed order wins for the players it contains and that are still candidates; candidates
        /// missing from it are appended in their proposed order.
        /// </summary>
        public static IReadOnlyList<FitCandidate> ApplyConfirmedOrder(
            IReadOnlyList<FitCandidate> proposed,
            IReadOnlyList<string> confirmedIds)
        {
            var byId = proposed.ToDictionary(c => c.TeamPlayerId);
            var confirmed = confirmedIds
                .Where(byId.ContainsKey)
                .Distinct()
                .Select(id => byId[id])
                .ToList();
            var confirmedSet = confirmed.Select(c => c.TeamPlayerId).ToHashSet();

            return confirmed.Concat(proposed.Where(c => !confirmedSet.Contains(c.TeamPlayerId))).ToList();
        }

        public static bool IsManual(IReadOnlyList<FitCandidate> proposed, IReadOnlyList<string> savedIds) =>
            !proposed.Select(c => c.TeamPlayerId).SequenceEqual(savedIds);
    }
}
