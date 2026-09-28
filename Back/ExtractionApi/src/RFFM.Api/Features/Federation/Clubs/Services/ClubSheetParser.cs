using System.Text.Json;
using System.Text.RegularExpressions;
using RFFM.Api.Features.Federation.Clubs.Models;

namespace RFFM.Api.Features.Federation.Clubs.Services
{
    public static class ClubSheetParser
    {
        private static readonly Regex NextDataRegex = new(
            @"<script[^>]*id=""__NEXT_DATA__""[^>]*>(.*?)</script>",
            RegexOptions.Singleline | RegexOptions.IgnoreCase | RegexOptions.Compiled);

        public static IReadOnlyList<ClubTeamDirectoryItem> ParseTeams(string html)
        {
            if (string.IsNullOrWhiteSpace(html)) return [];

            var match = NextDataRegex.Match(html);
            var json = match.Success ? match.Groups[1].Value.Trim() : string.Empty;
            if (json.Length == 0) return [];

            try
            {
                using var doc = JsonDocument.Parse(json);
                if (!TryGetEquiposClubArray(doc.RootElement, out var equiposClub)) return [];

                var results = new List<ClubTeamDirectoryItem>();
                foreach (var team in equiposClub.EnumerateArray())
                {
                    var teamCode = GetString(team, "codigo_equipo")?.Trim();
                    var teamName = GetString(team, "nombre_equipo")?.Trim();
                    var category = GetString(team, "categoria")?.Trim();
                    var inCompetitionRaw = GetString(team, "en_competicion")?.Trim();
                    var inCompetition = string.Equals(inCompetitionRaw, "1", StringComparison.OrdinalIgnoreCase) ||
                                        string.Equals(inCompetitionRaw, "true", StringComparison.OrdinalIgnoreCase);

                    if (string.IsNullOrWhiteSpace(teamCode) || string.IsNullOrWhiteSpace(teamName) || string.IsNullOrWhiteSpace(category))
                        continue;

                    results.Add(new ClubTeamDirectoryItem(teamCode, teamName, category, inCompetition));
                }

                return results;
            }
            catch (JsonException)
            {
                return [];
            }
        }

        private static bool TryGetEquiposClubArray(JsonElement root, out JsonElement equiposClub)
        {
            equiposClub = default;
            return root.TryGetProperty("props", out var props) &&
                   props.TryGetProperty("pageProps", out var pageProps) &&
                   pageProps.TryGetProperty("club", out var clubObj) &&
                   clubObj.TryGetProperty("equipos_club", out equiposClub) &&
                   equiposClub.ValueKind == JsonValueKind.Array;
        }

        private static string? GetString(JsonElement el, string propertyName)
        {
            if (!el.TryGetProperty(propertyName, out var prop)) return null;
            return prop.ValueKind switch
            {
                JsonValueKind.String => prop.GetString(),
                JsonValueKind.Number => prop.GetRawText(),
                _ => null
            };
        }
    }
}
