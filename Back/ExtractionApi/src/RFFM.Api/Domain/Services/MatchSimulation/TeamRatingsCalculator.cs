namespace RFFM.Api.Domain.Services.MatchSimulation
{
    public record TeamRating(double Attack, double Defense);

    public record TeamRatings(double MuHome, double MuAway, IReadOnlyDictionary<string, TeamRating> Teams)
    {
        public (double Local, double Visitor) ExpectedGoals(string localCode, string visitorCode)
        {
            var local = Teams[localCode];
            var visitor = Teams[visitorCode];
            return (Bound(MuHome * local.Attack * visitor.Defense), Bound(MuAway * visitor.Attack * local.Defense));
        }

        private static double Bound(double goals) =>
            Math.Clamp(goals, TeamRatingsCalculator.MinExpectedGoals, TeamRatingsCalculator.MaxExpectedGoals);
    }

    /// <summary>
    /// Ataque y defensa de cada equipo (1 = media de la liga): mezcla la fuerza de su plantilla con sus
    /// resultados, que pesan más según juega partidos (design.md D3).
    /// </summary>
    public static class TeamRatingsCalculator
    {
        public const double DefaultHomeGoals = 1.5;
        public const double DefaultAwayGoals = 1.2;
        public const double MinExpectedGoals = 0.1;
        public const double MaxExpectedGoals = 8;

        private const int ResultsHalfWeightMatches = 6;
        private const int LeagueAveragePriorMatches = 10;

        public static TeamRatings Calculate(IReadOnlyCollection<string> teamCodes, IReadOnlyList<SimMatch> calendar,
            IReadOnlyDictionary<string, double> squadStrength)
        {
            var codes = teamCodes.ToHashSet();
            var played = calendar.Where(m => m.HasResult && codes.Contains(m.LocalCode) && codes.Contains(m.VisitorCode)).ToList();

            var muHome = Shrink(played.Sum(m => m.LocalGoals!.Value), played.Count, DefaultHomeGoals);
            var muAway = Shrink(played.Sum(m => m.VisitorGoals!.Value), played.Count, DefaultAwayGoals);
            var mu = (muHome + muAway) / 2;

            var teams = codes.ToDictionary(code => code, code =>
            {
                var strength = squadStrength.GetValueOrDefault(code, 1d);
                var matches = played.Where(m => m.LocalCode == code || m.VisitorCode == code).ToList();
                if (matches.Count == 0)
                    return new TeamRating(strength, 1 / strength);

                var goalsFor = matches.Sum(m => m.LocalCode == code ? m.LocalGoals!.Value : m.VisitorGoals!.Value);
                var goalsAgainst = matches.Sum(m => m.LocalCode == code ? m.VisitorGoals!.Value : m.LocalGoals!.Value);
                var resultsWeight = (double)matches.Count / (matches.Count + ResultsHalfWeightMatches);

                var attackResults = (double)goalsFor / matches.Count / mu;
                var defenseResults = (double)goalsAgainst / matches.Count / mu;
                return new TeamRating(
                    resultsWeight * attackResults + (1 - resultsWeight) * strength,
                    resultsWeight * defenseResults + (1 - resultsWeight) / strength);
            });

            return new TeamRatings(muHome, muAway, teams);
        }

        private static double Shrink(int goals, int matches, double defaultGoals) =>
            (goals + LeagueAveragePriorMatches * defaultGoals) / (matches + LeagueAveragePriorMatches);
    }
}
