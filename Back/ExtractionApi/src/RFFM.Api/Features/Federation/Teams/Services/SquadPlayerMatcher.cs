using System.Globalization;
using System.Text;
using System.Text.Json.Serialization;
using RFFM.Api.Features.Federation.Players.Models;

namespace RFFM.Api.Features.Federation.Teams.Services
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum ComparedPlayerStatus
    {
        Licensed,
        Unlicensed,
        NotInTeam
    }

    public record SquadDbPlayer(string TeamPlayerId, string FullName, int? BirthYear, string? PhotoUrl, int? Dorsal);

    public record SquadRffmPlayer(string PlayerId, string Name, int? BirthYear, string? PhotoUrl, string? JerseyNumber,
        SeasonStats? Stats = null);

    public record ComparedPlayer(string Name, string? PhotoUrl, string? JerseyNumber,
        string? RffmPlayerId, string? TeamPlayerId, ComparedPlayerStatus Status, SeasonStats? Stats = null);

    public static class SquadPlayerMatcher
    {
        public static IReadOnlyList<ComparedPlayer> Compare(IEnumerable<SquadDbPlayer> dbPlayers, IEnumerable<SquadRffmPlayer> rffmPlayers)
        {
            var pending = rffmPlayers.Select(p => (Player: p, Tokens: Tokens(p.Name))).ToList();
            var squad = new List<ComparedPlayer>();

            foreach (var dbPlayer in dbPlayers)
            {
                var dbTokens = Tokens(dbPlayer.FullName);
                var match = pending
                    .Where(c => IsSameBirthYear(dbPlayer.BirthYear, c.Player.BirthYear) && IsSameName(dbTokens, c.Tokens))
                    .OrderByDescending(c => c.Tokens.Intersect(dbTokens).Count())
                    .Select(c => c.Player)
                    .FirstOrDefault();

                if (match is null)
                {
                    squad.Add(new ComparedPlayer(dbPlayer.FullName, Blank(dbPlayer.PhotoUrl), dbPlayer.Dorsal?.ToString(),
                        null, dbPlayer.TeamPlayerId, ComparedPlayerStatus.Unlicensed));
                    continue;
                }

                pending.RemoveAll(c => ReferenceEquals(c.Player, match));
                squad.Add(new ComparedPlayer(dbPlayer.FullName,
                    Blank(dbPlayer.PhotoUrl) ?? Blank(match.PhotoUrl),
                    dbPlayer.Dorsal?.ToString() ?? Blank(match.JerseyNumber),
                    match.PlayerId, dbPlayer.TeamPlayerId, ComparedPlayerStatus.Licensed, match.Stats));
            }

            var notInTeam = pending
                .Select(c => new ComparedPlayer(c.Player.Name, Blank(c.Player.PhotoUrl), Blank(c.Player.JerseyNumber),
                    c.Player.PlayerId, null, ComparedPlayerStatus.NotInTeam, c.Player.Stats))
                .OrderBy(p => p.Name, StringComparer.CurrentCultureIgnoreCase);

            return squad
                .OrderBy(p => JerseyOrder(p.JerseyNumber))
                .ThenBy(p => p.Name, StringComparer.CurrentCultureIgnoreCase)
                .Concat(notInTeam)
                .ToList();
        }

        internal static string[] Tokens(string? name)
        {
            if (string.IsNullOrWhiteSpace(name))
                return [];

            var withoutAccents = new StringBuilder();
            foreach (var c in name.Normalize(NormalizationForm.FormD))
            {
                if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark)
                    continue;
                withoutAccents.Append(char.IsLetterOrDigit(c) ? char.ToUpperInvariant(c) : ' ');
            }

            return withoutAccents.ToString()
                .Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Where(t => t.Length >= 2)
                .Distinct()
                .OrderBy(t => t, StringComparer.Ordinal)
                .ToArray();
        }

        private static bool IsSameName(string[] a, string[] b)
        {
            if (a.Length == 0 || b.Length == 0)
                return false;
            return a.All(b.Contains) || b.All(a.Contains);
        }

        private static bool IsSameBirthYear(int? a, int? b)
        {
            var bothKnown = a is > 0 && b is > 0;
            return !bothKnown || a == b;
        }

        private static int JerseyOrder(string? jersey)
            => int.TryParse(jersey, out var number) ? number : int.MaxValue;

        private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value;
    }
}
