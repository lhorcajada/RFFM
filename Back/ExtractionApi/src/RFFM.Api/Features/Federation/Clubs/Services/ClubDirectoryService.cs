using RFFM.Api.Features.Federation.Clubs.Models;
using RFFM.Api.Infrastructure.Helpers;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace RFFM.Api.Features.Federation.Clubs.Services
{
    public interface IClubDirectoryService
    {
        Task<IReadOnlyList<ClubDirectoryItem>> SearchAsync(string? search, string? codclub, CancellationToken cancellationToken = default);

        Task<IReadOnlyList<ClubTeamDirectoryItem>> GetClubTeamsAsync(string clubCode, CancellationToken cancellationToken = default);
    }

    public class ClubDirectoryService : IClubDirectoryService
    {
        private readonly HtmlFetcher _fetcher;

        public ClubDirectoryService(HttpClient http)
        {
            http.DefaultRequestHeaders.UserAgent.ParseAdd("RFFM.Extractor/1.0");
            _fetcher = new HtmlFetcher(http);
        }

        public async Task<IReadOnlyList<ClubDirectoryItem>> SearchAsync(string? search, string? codclub, CancellationToken cancellationToken = default)
        {
            var url = BuildUrl(search, codclub);

            var content = await _fetcher.FetchAsync(url, cancellationToken).ConfigureAwait(false);
            if (string.IsNullOrWhiteSpace(content))
                return Array.Empty<ClubDirectoryItem>();

            var embeddedJson = TryExtractNextDataJson(content);
            if (string.IsNullOrWhiteSpace(embeddedJson))
                return Array.Empty<ClubDirectoryItem>();

            try
            {
                using var doc = JsonDocument.Parse(embeddedJson);

                if (!TryGetClubesArray(doc.RootElement, out var clubes))
                    return Array.Empty<ClubDirectoryItem>();

                var results = new List<ClubDirectoryItem>();
                foreach (var club in clubes.EnumerateArray())
                {
                    var clubCode = GetString(club, "codigo_club")?.Trim();
                    var name = GetString(club, "nombre")?.Trim();
                    var teamsCount = GetInt(club, "total_equipos");

                    if (string.IsNullOrWhiteSpace(clubCode) || string.IsNullOrWhiteSpace(name))
                        continue;

                    results.Add(new ClubDirectoryItem(clubCode, name, teamsCount));
                }

                return results;
            }
            catch
            {
                return Array.Empty<ClubDirectoryItem>();
            }
        }

        public async Task<IReadOnlyList<ClubTeamDirectoryItem>> GetClubTeamsAsync(string clubCode, CancellationToken cancellationToken = default)
        {
            var normalizedClubCode = (clubCode ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(normalizedClubCode))
                return Array.Empty<ClubTeamDirectoryItem>();

            var url = $"https://www.rffm.es/fichaclub/{Uri.EscapeDataString(normalizedClubCode)}";
            var content = await _fetcher.FetchAsync(url, cancellationToken).ConfigureAwait(false);
            if (string.IsNullOrWhiteSpace(content))
                return Array.Empty<ClubTeamDirectoryItem>();

            var embeddedJson = TryExtractNextDataJson(content);
            if (string.IsNullOrWhiteSpace(embeddedJson))
                return Array.Empty<ClubTeamDirectoryItem>();

            try
            {
                using var doc = JsonDocument.Parse(embeddedJson);

                if (!TryGetEquiposClubArray(doc.RootElement, out var equiposClub))
                    return Array.Empty<ClubTeamDirectoryItem>();

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
            catch
            {
                return Array.Empty<ClubTeamDirectoryItem>();
            }
        }

        private static string BuildUrl(string? search, string? codclub)
        {
            var codclubValue = codclub ?? string.Empty;
            var searchValue = search ?? string.Empty;

            return $"https://www.rffm.es/competicion/clubes?codclub={Uri.EscapeDataString(codclubValue)}&search={Uri.EscapeDataString(searchValue)}";
        }

        private static string? TryExtractNextDataJson(string html)
        {
            var match = Regex.Match(
                html,
                @"<script[^>]*id=""__NEXT_DATA__""[^>]*>(.*?)</script>",
                RegexOptions.Singleline | RegexOptions.IgnoreCase);

            if (!match.Success)
                return null;

            var json = match.Groups[1].Value.Trim();
            return string.IsNullOrWhiteSpace(json) ? null : json;
        }

        private static bool TryGetClubesArray(JsonElement root, out JsonElement clubes)
        {
            clubes = default;

            if (!root.TryGetProperty("props", out var props))
                return false;
            if (!props.TryGetProperty("pageProps", out var pageProps))
                return false;
            if (!pageProps.TryGetProperty("clubs", out var clubsObj))
                return false;

            // En la web actual viene como clubs: { ..., clubes: [...] }
            if (!clubsObj.TryGetProperty("clubes", out clubes))
                return false;

            return clubes.ValueKind == JsonValueKind.Array;
        }

        private static bool TryGetEquiposClubArray(JsonElement root, out JsonElement equiposClub)
        {
            equiposClub = default;

            if (!root.TryGetProperty("props", out var props))
                return false;
            if (!props.TryGetProperty("pageProps", out var pageProps))
                return false;
            if (!pageProps.TryGetProperty("club", out var clubObj))
                return false;
            if (!clubObj.TryGetProperty("equipos_club", out equiposClub))
                return false;

            return equiposClub.ValueKind == JsonValueKind.Array;
        }

        private static string? GetString(JsonElement el, string propertyName)
        {
            if (!el.TryGetProperty(propertyName, out var prop))
                return null;

            return prop.ValueKind switch
            {
                JsonValueKind.String => prop.GetString(),
                JsonValueKind.Number => prop.GetRawText(),
                _ => null
            };
        }

        private static int GetInt(JsonElement el, string propertyName)
        {
            if (!el.TryGetProperty(propertyName, out var prop))
                return 0;

            try
            {
                if (prop.ValueKind == JsonValueKind.Number)
                {
                    if (prop.TryGetInt32(out var i))
                        return i;
                    if (prop.TryGetInt64(out var l))
                        return (int)l;
                }

                if (prop.ValueKind == JsonValueKind.String)
                {
                    var s = prop.GetString();
                    return int.TryParse(s, out var parsed) ? parsed : 0;
                }
            }
            catch
            {
                // ignore
            }

            return 0;
        }
    }
}
