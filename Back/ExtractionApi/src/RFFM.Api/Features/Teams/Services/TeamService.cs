using RFFM.Api.Features.Teams.Models;
using RFFM.Api.Infrastructure.Helpers;
using System.Text.Json;

namespace RFFM.Api.Features.Teams.Services
{
    public interface ITeamService
    {
        Task<Team> GetTeamDetailsAsync(string teamCode, CancellationToken cancellationToken = default);
    }

    public class TeamService : ITeamService
    {
        public async Task<Team> GetTeamDetailsAsync(string teamCode, CancellationToken cancellationToken)
        {
            var url = $"https://www.rffm.es/fichaequipo/{teamCode}";

            using var http = new HttpClient();
            // add a simple User-Agent to avoid some servers rejecting the request
            http.DefaultRequestHeaders.UserAgent.ParseAdd("RFFM.Extractor/1.0");

            var htmlFetcher = new HtmlFetcher(http);
            var content = await htmlFetcher.FetchAsync(url, cancellationToken);

            if (string.IsNullOrWhiteSpace(content))
                return new Team();

            try
            {
                // Extraer el JSON embebido en <script id="__NEXT_DATA__">...</script>
                var match = System.Text.RegularExpressions.Regex.Match(content,
                    @"<script[^>]*id=""__NEXT_DATA__""[^>]*>(.*?)</script>",
                    System.Text.RegularExpressions.RegexOptions.Singleline |
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (!match.Success)
                    return new Team();

                var json = match.Groups[1].Value.Trim();
                if (string.IsNullOrEmpty(json))
                    return new Team();

                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                if (!root.TryGetProperty("props", out var props) ||
                    !props.TryGetProperty("pageProps", out var pageProps))
                    return new Team();
                if (!pageProps.TryGetProperty("team", out var teamEl))
                    return new Team();

                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };
                var team = teamEl.Deserialize<Team>(options);
                return team ?? new Team();
            }
            catch
            {
                return new Team();
            }
        }
        
    }

}
