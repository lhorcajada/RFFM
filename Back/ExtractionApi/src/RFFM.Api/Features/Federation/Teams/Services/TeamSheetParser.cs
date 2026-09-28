using System.Text.Json;
using System.Text.RegularExpressions;
using RFFM.Api.Features.Federation.Teams.Models;

namespace RFFM.Api.Features.Federation.Teams.Services
{
    public static class TeamSheetParser
    {
        private static readonly Regex NextDataRegex = new(
            @"<script[^>]*id=""__NEXT_DATA__""[^>]*>(.*?)</script>",
            RegexOptions.Singleline | RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly JsonSerializerOptions SerializerOptions = new() { PropertyNameCaseInsensitive = true };

        public static TeamRffm? Parse(string html)
        {
            if (string.IsNullOrWhiteSpace(html)) return null;

            var match = NextDataRegex.Match(html);
            if (!match.Success) return null;

            var json = match.Groups[1].Value.Trim();
            if (string.IsNullOrEmpty(json)) return null;

            try
            {
                using var doc = JsonDocument.Parse(json);
                if (!doc.RootElement.TryGetProperty("props", out var props) ||
                    !props.TryGetProperty("pageProps", out var pageProps) ||
                    !pageProps.TryGetProperty("team", out var teamEl))
                    return null;

                return teamEl.Deserialize<TeamRffm>(SerializerOptions);
            }
            catch (JsonException)
            {
                return null;
            }
        }
    }
}
