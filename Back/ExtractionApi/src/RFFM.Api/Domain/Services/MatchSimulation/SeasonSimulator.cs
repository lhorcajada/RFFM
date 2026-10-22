using RFFM.Api.Domain.Entities.Federation.Results;

namespace RFFM.Api.Domain.Services.MatchSimulation
{
    public record MatchPrediction(SimMatch Match, double LocalExpectedGoals, double VisitorExpectedGoals, MatchOutcome Outcome);

    public record ProjectedStanding(string TeamCode, int CurrentPosition, int CurrentPoints, double ExpectedPoints,
        int MostLikelyPosition, double ChampionProbability, IReadOnlyList<double> PositionProbabilities,
        double Attack, double Defense, double SquadStrength);

    public record SimulationResult(int PlayedMatches, int PendingMatches, IReadOnlyList<MatchPrediction> Predictions,
        IReadOnlyList<ProjectedStanding> Standings);

    /// <summary>
    /// Predicción de los partidos pendientes y clasificación proyectada simulando el resto del calendario
    /// (design.md D5). Semilla fija: los mismos datos dan siempre el mismo resultado.
    /// </summary>
    public static class SeasonSimulator
    {
        public const int DefaultIterations = 10_000;
        public const int DefaultSeed = 20261022;

        private sealed record Fixture(int Local, int Visitor, double LocalLimit, double VisitorLimit);

        public static SimulationResult Run(SimulationInput input, int iterations = DefaultIterations, int seed = DefaultSeed)
        {
            var codes = input.Teams.Select(t => t.Code).Distinct().ToList();
            var codeSet = codes.ToHashSet();
            var calendar = input.Calendar.Where(m => codeSet.Contains(m.LocalCode) && codeSet.Contains(m.VisitorCode)).ToList();

            var strength = SquadStrengthCalculator.Calculate(codes, input.SquadsByTeam);
            var ratings = TeamRatingsCalculator.Calculate(codes, calendar, strength);

            var played = calendar.Where(m => m.HasResult).ToList();
            var predictions = calendar
                .Where(m => !m.HasResult)
                .OrderBy(m => m.Round)
                .Select(m =>
                {
                    var (local, visitor) = ratings.ExpectedGoals(m.LocalCode, m.VisitorCode);
                    return new MatchPrediction(m, local, visitor, MatchProbabilities.Calculate(local, visitor));
                })
                .ToList();

            var index = codes.Select((code, i) => (code, i)).ToDictionary(x => x.code, x => x.i);
            var names = input.Teams.GroupBy(t => t.Code).ToDictionary(g => g.Key, g => g.First().Name);
            var (points, goalsFor, goalsAgainst) = CurrentTable(codes, index, played, input);

            var currentOrder = Enumerable.Range(0, codes.Count)
                .OrderByDescending(i => points[i])
                .ThenByDescending(i => goalsFor[i] - goalsAgainst[i])
                .ThenByDescending(i => goalsFor[i])
                .ThenBy(i => names[codes[i]], StringComparer.OrdinalIgnoreCase)
                .ToList();
            var currentPosition = new int[codes.Count];
            for (var position = 0; position < currentOrder.Count; position++)
                currentPosition[currentOrder[position]] = position + 1;

            var (positionCounts, pointsSum, runs) = predictions.Count == 0
                ? CurrentAsCertain(codes.Count, currentPosition, points)
                : Simulate(predictions, index, points, goalsFor, goalsAgainst, input.Points, iterations, seed);

            var standings = codes.Select((code, i) =>
                {
                    var probabilities = Enumerable.Range(0, codes.Count).Select(p => (double)positionCounts[i, p] / runs).ToList();
                    var mostLikely = probabilities.IndexOf(probabilities.Max()) + 1;
                    return new ProjectedStanding(code, currentPosition[i], points[i], pointsSum[i] / runs, mostLikely,
                        probabilities[0], probabilities, ratings.Teams[code].Attack, ratings.Teams[code].Defense, strength[code]);
                })
                .OrderByDescending(s => s.ExpectedPoints)
                .ThenBy(s => s.CurrentPosition)
                .ToList();

            return new SimulationResult(played.Count, predictions.Count, predictions, standings);
        }

        private static (int[] Points, int[] GoalsFor, int[] GoalsAgainst) CurrentTable(IReadOnlyList<string> codes,
            IReadOnlyDictionary<string, int> index, IEnumerable<SimMatch> played, SimulationInput input)
        {
            var points = codes.Select(c => -input.SanctionPoints.GetValueOrDefault(c)).ToArray();
            var goalsFor = new int[codes.Count];
            var goalsAgainst = new int[codes.Count];

            foreach (var m in played)
                ApplyResult(index[m.LocalCode], index[m.VisitorCode], m.LocalGoals!.Value, m.VisitorGoals!.Value,
                    points, goalsFor, goalsAgainst, input.Points);

            return (points, goalsFor, goalsAgainst);
        }

        private static (int[,] PositionCounts, double[] PointsSum, int Runs) CurrentAsCertain(int teamCount,
            int[] currentPosition, int[] points)
        {
            var positionCounts = new int[teamCount, teamCount];
            for (var i = 0; i < teamCount; i++)
                positionCounts[i, currentPosition[i] - 1] = 1;
            return (positionCounts, points.Select(p => (double)p).ToArray(), 1);
        }

        private static (int[,] PositionCounts, double[] PointsSum, int Runs) Simulate(IReadOnlyList<MatchPrediction> predictions,
            IReadOnlyDictionary<string, int> index, int[] basePoints, int[] baseGoalsFor, int[] baseGoalsAgainst,
            RffmPointsSystem pointsSystem, int iterations, int seed)
        {
            var teamCount = basePoints.Length;
            var random = new Random(seed);
            var fixtures = predictions
                .Select(p => new Fixture(index[p.Match.LocalCode], index[p.Match.VisitorCode],
                    Math.Exp(-p.LocalExpectedGoals), Math.Exp(-p.VisitorExpectedGoals)))
                .ToList();

            var positionCounts = new int[teamCount, teamCount];
            var pointsSum = new double[teamCount];
            var points = new int[teamCount];
            var goalsFor = new int[teamCount];
            var goalsAgainst = new int[teamCount];
            var tieBreak = new double[teamCount];
            var order = new int[teamCount];

            for (var iteration = 0; iteration < iterations; iteration++)
            {
                Array.Copy(basePoints, points, teamCount);
                Array.Copy(baseGoalsFor, goalsFor, teamCount);
                Array.Copy(baseGoalsAgainst, goalsAgainst, teamCount);

                foreach (var f in fixtures)
                    ApplyResult(f.Local, f.Visitor, SamplePoisson(random, f.LocalLimit), SamplePoisson(random, f.VisitorLimit),
                        points, goalsFor, goalsAgainst, pointsSystem);

                for (var i = 0; i < teamCount; i++)
                {
                    order[i] = i;
                    tieBreak[i] = random.NextDouble();
                }

                Array.Sort(order, (a, b) =>
                {
                    var byPoints = points[b].CompareTo(points[a]);
                    if (byPoints != 0) return byPoints;
                    var byDifference = (goalsFor[b] - goalsAgainst[b]).CompareTo(goalsFor[a] - goalsAgainst[a]);
                    if (byDifference != 0) return byDifference;
                    var byGoalsFor = goalsFor[b].CompareTo(goalsFor[a]);
                    return byGoalsFor != 0 ? byGoalsFor : tieBreak[b].CompareTo(tieBreak[a]);
                });

                for (var position = 0; position < teamCount; position++)
                {
                    positionCounts[order[position], position]++;
                    pointsSum[order[position]] += points[order[position]];
                }
            }

            return (positionCounts, pointsSum, iterations);
        }

        private static void ApplyResult(int local, int visitor, int localGoals, int visitorGoals,
            int[] points, int[] goalsFor, int[] goalsAgainst, RffmPointsSystem pointsSystem)
        {
            goalsFor[local] += localGoals;
            goalsAgainst[local] += visitorGoals;
            goalsFor[visitor] += visitorGoals;
            goalsAgainst[visitor] += localGoals;

            if (localGoals > visitorGoals)
            {
                points[local] += pointsSystem.Win;
                points[visitor] += pointsSystem.Loss;
            }
            else if (localGoals < visitorGoals)
            {
                points[visitor] += pointsSystem.Win;
                points[local] += pointsSystem.Loss;
            }
            else
            {
                points[local] += pointsSystem.Draw;
                points[visitor] += pointsSystem.Draw;
            }
        }

        /// <summary>Algoritmo de Knuth; <paramref name="limit"/> = e^-λ precalculado (λ ≤ 8).</summary>
        private static int SamplePoisson(Random random, double limit)
        {
            var goals = -1;
            var product = 1d;
            do
            {
                goals++;
                product *= random.NextDouble();
            } while (product > limit);
            return goals;
        }
    }
}
