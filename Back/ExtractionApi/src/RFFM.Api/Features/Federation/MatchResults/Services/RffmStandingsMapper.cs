using System.Text.Json;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Features.Federation.Competitions.Models;

namespace RFFM.Api.Features.Federation.MatchResults.Services
{
    /// <summary>
    /// Convierte la clasificación calculada al contrato de <c>GET /classification</c> (el mismo que devolvía
    /// la RFFM) y extrae de la clasificación oficial lo que no se puede calcular: sanciones y colores.
    /// </summary>
    public static class RffmStandingsMapper
    {
        private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

        public static List<TeamResponse> Parse(string? standingsJson)
        {
            if (string.IsNullOrWhiteSpace(standingsJson))
                return [];
            try
            {
                return JsonSerializer.Deserialize<List<TeamResponse>>(standingsJson, JsonOptions) ?? [];
            }
            catch (JsonException)
            {
                return [];
            }
        }

        public static IReadOnlyDictionary<string, int> Sanctions(IEnumerable<TeamResponse> official) =>
            official
                .Where(t => !string.IsNullOrWhiteSpace(t.TeamId) && int.TryParse(t.SanctionPoints, out var s) && s != 0)
                .GroupBy(t => t.TeamId.Trim())
                .ToDictionary(g => g.Key, g => int.Parse(g.First().SanctionPoints));

        public static List<TeamResponse> ToTeamResponses(IReadOnlyList<StandingRow> rows, IReadOnlyList<TeamResponse> official)
        {
            var colorByPosition = official
                .Where(t => int.TryParse(t.Position, out _))
                .GroupBy(t => int.Parse(t.Position))
                .ToDictionary(g => g.Key, g => g.First().Color ?? string.Empty);

            return rows.Select(r => new TeamResponse
            {
                Color = colorByPosition.GetValueOrDefault(r.Position, string.Empty),
                Position = r.Position.ToString(),
                ImageUrl = r.ImageUrl,
                TeamId = r.TeamCode,
                TeamName = r.TeamName,
                Played = r.Played.ToString(),
                Won = r.Won.ToString(),
                Lost = r.Lost.ToString(),
                Drawn = r.Drawn.ToString(),
                Penalties = "0",
                GoalsFor = r.GoalsFor.ToString(),
                GoalsAgainst = r.GoalsAgainst.ToString(),
                HomePlayed = r.HomePlayed.ToString(),
                HomeWon = r.HomeWon.ToString(),
                HomeDrawn = r.HomeDrawn.ToString(),
                HomePenaltyWins = string.Empty,
                HomeLost = r.HomeLost.ToString(),
                AwayPlayed = r.AwayPlayed.ToString(),
                AwayWon = r.AwayWon.ToString(),
                AwayDrawn = r.AwayDrawn.ToString(),
                AwayPenaltyWins = string.Empty,
                AwayLost = r.AwayLost.ToString(),
                Points = r.Points.ToString(),
                SanctionPoints = r.SanctionPoints.ToString(),
                HomePoints = r.HomePoints.ToString(),
                AwayPoints = r.AwayPoints.ToString(),
                ShowCoefficient = "0",
                Coefficient = string.Empty,
                MatchStreaks = r.Streak.Select(c => new MatchStreakResponse { Type = c.ToString() }).ToList()
            }).ToList();
        }

        /// <summary>Mismos equipos con los mismos partidos jugados, puntos y goles (el orden puede diferir).</summary>
        public static bool HaveSameStats(IReadOnlyList<TeamResponse> official, IReadOnlyList<TeamResponse> computed)
        {
            static string Key(TeamResponse t) => $"{t.TeamId?.Trim()}|{t.Played}|{t.Points}|{t.GoalsFor}|{t.GoalsAgainst}";
            return official.Count == computed.Count &&
                   official.Select(Key).OrderBy(k => k).SequenceEqual(computed.Select(Key).OrderBy(k => k));
        }
    }
}
