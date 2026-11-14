namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    /// <summary>
    /// Order of candidates of a unified position confirmed by the coach for a week (Monday).
    /// Position is the numeric value of <c>FitPosition</c>.
    /// </summary>
    public class TeamPositionFitOrder : BaseEntity
    {
        public string TeamId { get; private set; } = null!;
        public int Position { get; private set; }
        public DateTime WeekStart { get; private set; }
        public bool IsManual { get; private set; }

        private readonly List<TeamPositionFitOrderEntry> _entries = new();
        public IReadOnlyList<TeamPositionFitOrderEntry> Entries => _entries.AsReadOnly();

        private TeamPositionFitOrder() { }

        public static TeamPositionFitOrder Create(
            string teamId,
            int position,
            DateTime weekStart,
            IReadOnlyList<string> orderedTeamPlayerIds,
            bool isManual)
        {
            if (orderedTeamPlayerIds.Count == 0)
                throw new ArgumentException("The order must contain at least one player.", nameof(orderedTeamPlayerIds));
            if (orderedTeamPlayerIds.Distinct().Count() != orderedTeamPlayerIds.Count)
                throw new ArgumentException("A player can only appear once in the order.", nameof(orderedTeamPlayerIds));

            var order = new TeamPositionFitOrder
            {
                TeamId = teamId,
                Position = position,
                WeekStart = weekStart.Date,
                IsManual = isManual,
            };

            for (var index = 0; index < orderedTeamPlayerIds.Count; index++)
                order._entries.Add(TeamPositionFitOrderEntry.Create(order.Id, orderedTeamPlayerIds[index], index + 1));

            return order;
        }
    }

    public class TeamPositionFitOrderEntry : BaseEntity
    {
        public string OrderId { get; private set; } = null!;
        public string TeamPlayerId { get; private set; } = null!;
        public int Place { get; private set; }

        public TeamPositionFitOrder Order { get; private set; } = null!;

        private TeamPositionFitOrderEntry() { }

        public static TeamPositionFitOrderEntry Create(string orderId, string teamPlayerId, int place) =>
            new() { OrderId = orderId, TeamPlayerId = teamPlayerId, Place = place };
    }

    /// <summary>Team override of how much a trait counts for a position (key, sum or indifferent).</summary>
    public class TeamTraitWeight : BaseEntity
    {
        public string TeamId { get; private set; } = null!;
        public int Position { get; private set; }
        public string TraitKey { get; private set; } = null!;
        public string Weight { get; private set; } = null!;

        private TeamTraitWeight() { }

        public static TeamTraitWeight Create(string teamId, int position, string traitKey, string weight) =>
            new() { TeamId = teamId, Position = position, TraitKey = traitKey, Weight = weight };
    }
}
