namespace RFFM.Api.Domain.Services.MatchSimulation
{
    public record MatchOutcome(double Home, double Draw, double Away, int MostLikelyLocalGoals, int MostLikelyVisitorGoals);

    /// <summary>Probabilidades exactas de un partido con un Poisson independiente por equipo (design.md D4).</summary>
    public static class MatchProbabilities
    {
        private const int MaxGoals = 10;
        private const double Tolerance = 1e-12;

        public static MatchOutcome Calculate(double localExpectedGoals, double visitorExpectedGoals)
        {
            var local = PoissonDistribution(localExpectedGoals);
            var visitor = PoissonDistribution(visitorExpectedGoals);

            double home = 0, draw = 0, away = 0, best = -1;
            var (bestLocal, bestVisitor) = (0, 0);
            for (var l = 0; l <= MaxGoals; l++)
            {
                for (var v = 0; v <= MaxGoals; v++)
                {
                    var p = local[l] * visitor[v];
                    if (l > v) home += p;
                    else if (l == v) draw += p;
                    else away += p;

                    var isMoreLikely = p > best + Tolerance ||
                                       (Math.Abs(p - best) <= Tolerance && l + v < bestLocal + bestVisitor);
                    if (isMoreLikely)
                        (best, bestLocal, bestVisitor) = (p, l, v);
                }
            }

            var total = home + draw + away;
            return new MatchOutcome(home / total, draw / total, away / total, bestLocal, bestVisitor);
        }

        private static double[] PoissonDistribution(double lambda)
        {
            var probabilities = new double[MaxGoals + 1];
            probabilities[0] = Math.Exp(-lambda);
            for (var k = 1; k <= MaxGoals; k++)
                probabilities[k] = probabilities[k - 1] * lambda / k;
            return probabilities;
        }
    }
}
