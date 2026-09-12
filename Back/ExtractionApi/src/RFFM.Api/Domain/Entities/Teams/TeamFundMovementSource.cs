using Ardalis.SmartEnum;

namespace RFFM.Api.Domain.Entities.Teams
{
    public sealed class TeamFundMovementSource : SmartEnum<TeamFundMovementSource>
    {
        public static readonly TeamFundMovementSource SanctionPayment = new(nameof(SanctionPayment), 1);

        /// <summary>Defined now so the SmartEnum doesn't need a migration later; no endpoint
        /// produces this value yet (see design.md Non-Goals).</summary>
        public static readonly TeamFundMovementSource ManualAdjustment = new(nameof(ManualAdjustment), 2);

        private TeamFundMovementSource(string name, int value) : base(name, value)
        {
        }

        public static bool TryParseName(string? name, out TeamFundMovementSource? source)
        {
            source = null;
            if (string.IsNullOrWhiteSpace(name))
                return false;

            foreach (var candidate in List)
            {
                if (string.Equals(candidate.Name, name, System.StringComparison.OrdinalIgnoreCase))
                {
                    source = candidate;
                    return true;
                }
            }

            return false;
        }
    }
}
