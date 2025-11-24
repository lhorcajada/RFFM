using System.Text.RegularExpressions;
using System.Globalization;

namespace RFFM.Api.Features.Teams.Services
{
    public class GoalMinuteParser : IGoalMinuteParser
    {
        private static readonly Regex MinuteRegex = new("^(\\d+)(?:\\+(\\d+))?", RegexOptions.Compiled);

        public (int Main, int Total) Parse(string? minute)
        {
            if (string.IsNullOrWhiteSpace(minute))
                return (-1, -1);

            var m = MinuteRegex.Match(minute.Trim());
            if (!m.Success)
                return (-1, -1);

            if (!int.TryParse(m.Groups[1].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var main))
                return (-1, -1);

            var extra = 0;
            if (m.Groups.Count > 2 && !string.IsNullOrEmpty(m.Groups[2].Value))
                int.TryParse(m.Groups[2].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out extra);

            return (main, main + extra);
        }
    }
}