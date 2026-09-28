using RFFM.Api.Features.Federation.Teams.Models;

namespace RFFM.Api.Features.Federation.SquadHistory.Services
{
    public record ActaPlayerStats(int CallUps, int Starts, int Goals, int YellowCards, int RedCards);

    public static class SquadHistoryActaAggregator
    {
        private const string YellowCardCode = "100";
        private const string RedCardCode = "101";
        private const string DoubleYellowCardCode = "102";
        private const string OwnGoalCode = "102";

        public static ActaPlayerStats Aggregate(string playerCode, string teamCode, IEnumerable<MatchRffm> actas)
        {
            int callUps = 0, starts = 0, goals = 0, yellow = 0, red = 0;

            foreach (var acta in actas)
            {
                var isHome = SameCode(acta.LocalTeamCode, teamCode);
                var isAway = SameCode(acta.AwayTeamCode, teamCode);
                if (!isHome && !isAway) continue;

                var lineup = isHome ? acta.LocalPlayers : acta.AwayPlayers;
                var lineupEntry = lineup?.FirstOrDefault(p => SameCode(p.PlayerCode, playerCode));
                if (lineupEntry != null)
                {
                    callUps++;
                    if (IsTruthy(lineupEntry.Starter)) starts++;
                }

                goals += (acta.LocalGoalsList ?? []).Concat(acta.AwayGoalsList ?? [])
                    .Count(g => SameCode(g.PlayerCode, playerCode) && g.GoalType?.Trim() != OwnGoalCode);

                var cards = (isHome ? acta.LocalCards : acta.AwayCards) ?? [];
                foreach (var card in cards.Where(c => SameCode(c.PlayerCode, playerCode)))
                {
                    var type = card.CardType?.Trim();
                    var isDoubleYellow = type == DoubleYellowCardCode || IsTruthy(card.SecondYellow);
                    if (isDoubleYellow || type == RedCardCode) red++;
                    else if (type == YellowCardCode) yellow++;
                }
            }

            return new ActaPlayerStats(callUps, starts, goals, yellow, red);
        }

        private static bool SameCode(string? a, string? b) =>
            !string.IsNullOrWhiteSpace(a) && string.Equals(a.Trim(), b?.Trim(), StringComparison.OrdinalIgnoreCase);

        private static bool IsTruthy(string? value)
        {
            var normalized = value?.Trim().ToLowerInvariant();
            return normalized is "1" or "true" or "si" or "s" or "t" or "titular";
        }
    }
}
