using Ardalis.SmartEnum;

namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    public sealed class SanctionCategory : SmartEnum<SanctionCategory>
    {
        public static readonly SanctionCategory Competition = new(nameof(Competition), 1);
        public static readonly SanctionCategory InternalDiscipline = new(nameof(InternalDiscipline), 2);

        private SanctionCategory(string name, int value) : base(name, value)
        {
        }

        public static bool TryParseName(string? name, out SanctionCategory? category)
        {
            category = null;
            if (string.IsNullOrWhiteSpace(name))
                return false;

            foreach (var candidate in List)
            {
                if (string.Equals(candidate.Name, name, System.StringComparison.OrdinalIgnoreCase))
                {
                    category = candidate;
                    return true;
                }
            }

            return false;
        }
    }
}
