using Ardalis.SmartEnum;

namespace RFFM.Api.Domain.Entities.News
{
    public sealed class NewsStatus : SmartEnum<NewsStatus>
    {
        public static readonly NewsStatus Draft = new(nameof(Draft), 1);
        public static readonly NewsStatus Published = new(nameof(Published), 2);

        private NewsStatus(string name, int value) : base(name, value)
        {
        }

        public static bool TryParseName(string? name, out NewsStatus? status)
        {
            status = null;
            if (string.IsNullOrWhiteSpace(name))
                return false;

            foreach (var candidate in List)
            {
                if (string.Equals(candidate.Name, name, System.StringComparison.OrdinalIgnoreCase))
                {
                    status = candidate;
                    return true;
                }
            }

            return false;
        }
    }
}
