using RFFM.Api.Features.Players.Models;
using RFFM.Api.Features.Teams.Models;
using RFFM.Api.Infrastructure.Helpers;
using System.Text.Json;
using RFFM.Api.Features.Players.Services;
using static RFFM.Api.Features.Teams.Queries.GetAgeSummary;

namespace RFFM.Api.Features.Teams.Services
{
    public interface ITeamService
    {
        Task<TeamRffm> GetTeamDetailsAsync(string teamCode, CancellationToken cancellationToken = default);

        Task<((TeamPlayerRffm teamPlayer, Player? playerDetails)[] resolved, AgeCount[] handle)> GetStaticsTeamPlayers(
            AgesQuery request, CancellationToken cancellationToken);
    }

    public class TeamService : ITeamService
    {
        private readonly IPlayerService _playerService;

        public TeamService(IPlayerService playerService)
        {
            _playerService = playerService;
        }

        public async Task<TeamRffm> GetTeamDetailsAsync(string teamCode, CancellationToken cancellationToken)
        {
            var url = $"https://www.rffm.es/fichaequipo/{teamCode}";

            using var http = new HttpClient();
            // add a simple User-Agent to avoid some servers rejecting the request
            http.DefaultRequestHeaders.UserAgent.ParseAdd("RFFM.Extractor/1.0");

            var htmlFetcher = new HtmlFetcher(http);
            var content = await htmlFetcher.FetchAsync(url, cancellationToken);

            if (string.IsNullOrWhiteSpace(content))
                return new TeamRffm();

            try
            {
                // Extraer el JSON embebido en <script id="__NEXT_DATA__">...</script>
                var match = System.Text.RegularExpressions.Regex.Match(content,
                    @"<script[^>]*id=""__NEXT_DATA__""[^>]*>(.*?)</script>",
                    System.Text.RegularExpressions.RegexOptions.Singleline |
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (!match.Success)
                    return new TeamRffm();

                var json = match.Groups[1].Value.Trim();
                if (string.IsNullOrEmpty(json))
                    return new TeamRffm();

                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                if (!root.TryGetProperty("props", out var props) ||
                    !props.TryGetProperty("pageProps", out var pageProps))
                    return new TeamRffm();
                if (!pageProps.TryGetProperty("team", out var teamEl))
                    return new TeamRffm();

                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };
                var team = teamEl.Deserialize<TeamRffm>(options);
                return team ?? new TeamRffm();
            }
            catch
            {
                return new TeamRffm();
            }
        }

        public async Task<((TeamPlayerRffm teamPlayer, Player? playerDetails)[] resolved, AgeCount[] handle)> GetStaticsTeamPlayers(AgesQuery request, CancellationToken cancellationToken)
        {
            var team = await GetTeamDetailsAsync(request.TeamId.ToString(), cancellationToken);
            if (team == null || team.Players == null || !team.Players.Any())
                return (Array.Empty<(TeamPlayerRffm teamPlayer, Player? playerDetails)>(), Array.Empty<AgeCount>());

            // For each player in the team, try to fetch full player details to get accurate age/stats.
            var playerTasks = team.Players.Select(async p =>
            {

                // If we have an id, try to fetch player details
                if (!string.IsNullOrWhiteSpace(p.PlayerCode))
                {
                    try
                    {
                        var pl = await _playerService.GetPlayerAsync(p.PlayerCode!, request.SeasonId, cancellationToken);
                        return (teamPlayer: p, playerDetails: pl);
                    }
                    catch
                    {
                        // Ignore per-player errors and fallback to team payload
                    }
                }

                return (teamPlayer: p, playerDetails: (RFFM.Api.Features.Players.Models.Player?)null);
            }).ToArray();

            var resolved = await Task.WhenAll(playerTasks);

            // compute age counts here
            var ages = new List<int>();
            foreach (var item in resolved)
            {
                var p = item.teamPlayer;
                var pd = item.playerDetails;
                int? age = null;

                if (pd != null)
                {
                    if (pd.Age > 0) age = pd.Age;
                    else if (pd.BirthYear > 0) age = DateTime.Now.Year - pd.BirthYear;
                }

                if (!age.HasValue)
                {
                    if (p.GetType().GetProperty("Age") != null)
                    {
                        var val = p.GetType().GetProperty("Age")!.GetValue(p);
                        if (val is int vi && vi > 0) age = vi;
                    }

                    if (!age.HasValue && p.GetType().GetProperty("Ace") != null)
                    {
                        var val = p.GetType().GetProperty("Ace")!.GetValue(p);
                        if (val is int vi && vi > 0) age = vi;
                    }

                    if (!age.HasValue && p.GetType().GetProperty("Edad") != null)
                    {
                        var val = p.GetType().GetProperty("Edad")!.GetValue(p);
                        if (val is int vi && vi > 0) age = vi;
                    }

                    if (!age.HasValue && !string.IsNullOrWhiteSpace(p.Name))
                    {
                        var m = System.Text.RegularExpressions.Regex.Match(p.Name, "(\\d{1,2})");
                        if (m.Success && int.TryParse(m.Value, out var parsed)) age = parsed;
                    }
                }

                if (age.HasValue)
                    ages.Add(age.Value);
            }

            var grouped = ages.GroupBy(a => a)
                .Select(g => new AgeCount { Age = g.Key, Total = g.Count() })
                .OrderBy(a => a.Age)
                .ToArray();

            return (resolved, grouped);
        }
    }

}
