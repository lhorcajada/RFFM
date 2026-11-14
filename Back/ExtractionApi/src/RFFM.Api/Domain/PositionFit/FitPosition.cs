using RFFM.Api.Domain.Entities.Demarcations;

namespace RFFM.Api.Domain.PositionFit
{
    public enum FitPosition
    {
        Goalkeeper = 1,
        CenterBack = 2,
        FullBack = 3,
        DefensiveMidfielder = 4,
        Midfielder = 5,
        AttackingMidfielder = 6,
        Winger = 7,
        Forward = 8,
    }

    public static class FitPositionMap
    {
        private static readonly Dictionary<int, FitPosition> ByDemarcationId = new()
        {
            [DemarcationMaster.GoalKeeper.Id] = FitPosition.Goalkeeper,
            [DemarcationMaster.LeftBack.Id] = FitPosition.FullBack,
            [DemarcationMaster.RightBack.Id] = FitPosition.FullBack,
            [DemarcationMaster.CenterBack.Id] = FitPosition.CenterBack,
            [DemarcationMaster.Sweeper.Id] = FitPosition.CenterBack,
            [DemarcationMaster.CentralMidfielder.Id] = FitPosition.Midfielder,
            [DemarcationMaster.DefensiveMidfielder.Id] = FitPosition.DefensiveMidfielder,
            [DemarcationMaster.AttackingMidfielder.Id] = FitPosition.AttackingMidfielder,
            [DemarcationMaster.LeftMidfielder.Id] = FitPosition.Midfielder,
            [DemarcationMaster.RightMidfielder.Id] = FitPosition.Midfielder,
            [DemarcationMaster.Striker.Id] = FitPosition.Forward,
            [DemarcationMaster.CenterForward.Id] = FitPosition.Forward,
            [DemarcationMaster.LeftWinger.Id] = FitPosition.Winger,
            [DemarcationMaster.RightWinger.Id] = FitPosition.Winger,
        };

        public static FitPosition? PositionFor(int demarcationId) =>
            ByDemarcationId.TryGetValue(demarcationId, out var position) ? position : null;

        /// <summary>
        /// Positions a player competes in: the one of the active demarcation plus those of the possible
        /// demarcations, without duplicates. Goalkeepers are excluded from fit ranking.
        /// </summary>
        public static IReadOnlyList<FitPosition> CandidatePositions(int? activePositionId, IEnumerable<int>? possibleDemarcationIds)
        {
            var demarcationIds = (possibleDemarcationIds ?? Enumerable.Empty<int>()).ToList();
            if (activePositionId.HasValue)
                demarcationIds.Insert(0, activePositionId.Value);

            return demarcationIds
                .Select(PositionFor)
                .Where(position => position.HasValue && position.Value != FitPosition.Goalkeeper)
                .Select(position => position!.Value)
                .Distinct()
                .ToList();
        }
    }

    public static class FitPositionKeys
    {
        /// <summary>Positions evaluated for fit (goalkeeper excluded), in display order.</summary>
        public static readonly IReadOnlyList<FitPosition> Evaluated = new[]
        {
            FitPosition.CenterBack,
            FitPosition.FullBack,
            FitPosition.DefensiveMidfielder,
            FitPosition.Midfielder,
            FitPosition.AttackingMidfielder,
            FitPosition.Winger,
            FitPosition.Forward,
        };

        public static string ToKey(FitPosition position)
        {
            var name = position.ToString();
            return char.ToLowerInvariant(name[0]) + name[1..];
        }

        /// <summary>Parses a camelCase evaluated position key; goalkeeper and unknown keys return null.</summary>
        public static FitPosition? TryParse(string? key) =>
            Evaluated.Cast<FitPosition?>().FirstOrDefault(p => ToKey(p!.Value) == key);
    }
}
