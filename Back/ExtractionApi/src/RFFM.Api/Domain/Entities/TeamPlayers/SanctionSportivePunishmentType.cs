using Ardalis.SmartEnum;

namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    public sealed class SanctionSportivePunishmentType : SmartEnum<SanctionSportivePunishmentType>
    {
        public static readonly SanctionSportivePunishmentType Deconvocation = new(nameof(Deconvocation), 1);
        public static readonly SanctionSportivePunishmentType MinutesLimit = new(nameof(MinutesLimit), 2);

        private SanctionSportivePunishmentType(string name, int value) : base(name, value)
        {
        }

        public static bool TryParseName(string? name, out SanctionSportivePunishmentType? type)
        {
            type = null;
            if (string.IsNullOrWhiteSpace(name))
                return false;

            foreach (var candidate in List)
            {
                if (string.Equals(candidate.Name, name, System.StringComparison.OrdinalIgnoreCase))
                {
                    type = candidate;
                    return true;
                }
            }

            return false;
        }
    }
}
