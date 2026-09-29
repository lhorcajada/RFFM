namespace RFFM.Api.Domain.Entities.Federation.Results
{
    public record RffmPointsSystem(int Win, int Draw, int Loss)
    {
        public static readonly RffmPointsSystem Default = new(3, 1, 0);
    }

    public record StandingsMatch(int Round, string LocalCode, string VisitorCode, int? LocalGoals, int? VisitorGoals)
    {
        public bool HasResult => LocalGoals.HasValue && VisitorGoals.HasValue;
    }

    public record StandingsTeam(string Code, string Name, string ImageUrl);

    public record StandingRow(int Position, string TeamCode, string TeamName, string ImageUrl,
        int Played, int Won, int Drawn, int Lost, int GoalsFor, int GoalsAgainst,
        int HomePlayed, int HomeWon, int HomeDrawn, int HomeLost,
        int AwayPlayed, int AwayWon, int AwayDrawn, int AwayLost,
        int Points, int SanctionPoints, int HomePoints, int AwayPoints, string Streak);

    /// <summary>
    /// Clasificación según el Reglamento General de la RFFM (arts. 45 y 46), validada contra las
    /// clasificaciones oficiales de la temporada 2025-2026:
    /// cuentan los partidos con resultado (con o sin acta cerrada); el enfrentamiento directo solo se
    /// aplica cuando se han jugado todos los partidos programados entre los empatados; los criterios
    /// son eliminatorios (art. 46.2.d); a una sola vuelta, DG y GF van antes que el directo (art. 46.3).
    /// </summary>
    public static class RffmStandingsCalculator
    {
        private const int StreakLength = 5;

        private sealed class Stats
        {
            public int Played, Won, Drawn, Lost, GoalsFor, GoalsAgainst;
            public int HomePlayed, HomeWon, HomeDrawn, HomeLost, AwayPlayed, AwayWon, AwayDrawn, AwayLost;
            public int Points, HomePoints, AwayPoints;
            public readonly List<(int Round, char Result)> Results = new();
            public int GoalDifference => GoalsFor - GoalsAgainst;
        }

        public static IReadOnlyList<StandingRow> Calculate(IEnumerable<StandingsTeam> teams, IReadOnlyList<StandingsMatch> calendar,
            int upToRound, RffmPointsSystem points, IReadOnlyDictionary<string, int> sanctions)
        {
            var teamList = teams.GroupBy(t => t.Code).Select(g => g.First()).ToList();
            var names = teamList.ToDictionary(t => t.Code, t => t.Name);
            var played = calendar.Where(m => m.Round <= upToRound && m.HasResult).ToList();
            var stats = Aggregate(teamList.Select(t => t.Code), played, points);

            foreach (var (code, sanction) in sanctions)
                if (stats.TryGetValue(code, out var s))
                    s.Points -= sanction;

            var isSingleRoundRobin = calendar
                .GroupBy(m => PairKey(m.LocalCode, m.VisitorCode))
                .All(g => g.Count() <= 1);

            var ordered = stats.Keys
                .GroupBy(code => stats[code].Points)
                .OrderByDescending(g => g.Key)
                .SelectMany(g => Resolve(g.ToList()))
                .ToList();

            return ordered.Select((code, index) =>
            {
                var s = stats[code];
                var team = teamList.First(t => t.Code == code);
                var streak = new string(s.Results.OrderBy(r => r.Round).Select(r => r.Result).TakeLast(StreakLength).ToArray());
                return new StandingRow(index + 1, code, team.Name, team.ImageUrl,
                    s.Played, s.Won, s.Drawn, s.Lost, s.GoalsFor, s.GoalsAgainst,
                    s.HomePlayed, s.HomeWon, s.HomeDrawn, s.HomeLost,
                    s.AwayPlayed, s.AwayWon, s.AwayDrawn, s.AwayLost,
                    s.Points, sanctions.GetValueOrDefault(code), s.HomePoints, s.AwayPoints, streak);
            }).ToList();

            IEnumerable<string> Resolve(List<string> tied)
            {
                if (tied.Count == 1)
                    return tied;

                foreach (var criterion in Criteria(tied))
                {
                    var buckets = tied.GroupBy(criterion).ToList();
                    if (buckets.Count <= 1)
                        continue;

                    var best = buckets.OrderByDescending(b => b.Key).First().ToList();
                    var rest = tied.Except(best).ToList();
                    return Resolve(best).Concat(Resolve(rest));
                }

                return tied.OrderBy(code => names[code], StringComparer.OrdinalIgnoreCase);
            }

            IEnumerable<Func<string, int>> Criteria(List<string> tied)
            {
                var tiedSet = tied.ToHashSet();
                var scheduledBetween = calendar.Where(m => tiedSet.Contains(m.LocalCode) && tiedSet.Contains(m.VisitorCode)).ToList();
                var headToHeadComplete = scheduledBetween.Count > 0 &&
                                         scheduledBetween.All(m => m.Round <= upToRound && m.HasResult);
                var mini = Aggregate(tied, scheduledBetween.Where(m => m.Round <= upToRound && m.HasResult), points);

                Func<string, int> generalGoalDifference = code => stats[code].GoalDifference;
                Func<string, int> goalsFor = code => stats[code].GoalsFor;
                Func<string, int> miniPoints = code => mini[code].Points;
                Func<string, int> miniGoalDifference = code => mini[code].GoalDifference;

                if (isSingleRoundRobin)
                {
                    yield return generalGoalDifference;
                    yield return goalsFor;
                    if (headToHeadComplete)
                    {
                        yield return miniPoints;
                        yield return miniGoalDifference;
                    }
                    yield break;
                }

                if (headToHeadComplete)
                {
                    if (tied.Count > 2)
                        yield return miniPoints;
                    yield return miniGoalDifference;
                }

                yield return generalGoalDifference;
                yield return goalsFor;
            }
        }

        private static Dictionary<string, Stats> Aggregate(IEnumerable<string> teams, IEnumerable<StandingsMatch> matches,
            RffmPointsSystem points)
        {
            var stats = teams.Distinct().ToDictionary(t => t, _ => new Stats());
            foreach (var m in matches)
            {
                if (!stats.TryGetValue(m.LocalCode, out var local) || !stats.TryGetValue(m.VisitorCode, out var visitor))
                    continue;

                var localGoals = m.LocalGoals!.Value;
                var visitorGoals = m.VisitorGoals!.Value;
                Apply(local, localGoals, visitorGoals, isHome: true, m.Round, points);
                Apply(visitor, visitorGoals, localGoals, isHome: false, m.Round, points);
            }

            return stats;
        }

        private static void Apply(Stats s, int scored, int conceded, bool isHome, int round, RffmPointsSystem points)
        {
            var result = scored > conceded ? 'G' : scored < conceded ? 'P' : 'E';
            var earned = result switch { 'G' => points.Win, 'E' => points.Draw, _ => points.Loss };

            s.Played++;
            s.GoalsFor += scored;
            s.GoalsAgainst += conceded;
            s.Points += earned;
            s.Results.Add((round, result));
            switch (result)
            {
                case 'G': s.Won++; break;
                case 'E': s.Drawn++; break;
                default: s.Lost++; break;
            }

            if (isHome)
            {
                s.HomePlayed++;
                s.HomePoints += earned;
                if (result == 'G') s.HomeWon++; else if (result == 'E') s.HomeDrawn++; else s.HomeLost++;
            }
            else
            {
                s.AwayPlayed++;
                s.AwayPoints += earned;
                if (result == 'G') s.AwayWon++; else if (result == 'E') s.AwayDrawn++; else s.AwayLost++;
            }
        }

        private static string PairKey(string a, string b) =>
            string.CompareOrdinal(a, b) < 0 ? $"{a}|{b}" : $"{b}|{a}";
    }
}
