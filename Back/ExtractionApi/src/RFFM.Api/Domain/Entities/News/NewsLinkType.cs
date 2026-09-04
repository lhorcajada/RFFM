using Ardalis.SmartEnum;

namespace RFFM.Api.Domain.Entities.News
{
    public sealed class NewsLinkType : SmartEnum<NewsLinkType>
    {
        public static readonly NewsLinkType None = new(nameof(None), 1);
        public static readonly NewsLinkType MatchConvocation = new(nameof(MatchConvocation), 2);
        public static readonly NewsLinkType External = new(nameof(External), 3);

        private NewsLinkType(string name, int value) : base(name, value)
        {
        }

        public static bool TryParseName(string? name, out NewsLinkType? type)
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
