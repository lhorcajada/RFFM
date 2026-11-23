namespace RFFM.Api.Domain.Services.MatchSimulation
{
    public record MatchOutcome(double Home, double Draw, double Away, int MostLikelyLocalGoals, int MostLikelyVisitorGoals);

    /// <summary>
    /// Probabilidades exactas de un partido con un Poisson independiente por equipo (design.md D4).
    /// El marcador devuelto es el más probable dentro del resultado favorito (victoria local, empate o victoria
    /// visitante), para que sea coherente con las probabilidades 1X2 y no con el máximo marcador individual.
    /// </summary>
    public static class MatchProbabilities
    {
        private const int MaxGoals = 10;
        private const double Tolerance = 1e-12;

        public static MatchOutcome Calculate(double localExpectedGoals, double visitorExpectedGoals)
        {
            var local = PoissonDistribution(localExpectedGoals);
            var visitor = PoissonDistribution(visitorExpectedGoals);

            double home = 0, draw = 0, away = 0;
            var bestHome = new BestScore();
            var bestDraw = new BestScore();
            var bestAway = new BestScore();
            for (var l = 0; l <= MaxGoals; l++)
            {
                for (var v = 0; v <= MaxGoals; v++)
                {
                    var p = local[l] * visitor[v];
                    if (l > v) { home += p; bestHome.Consider(p, l, v); }
                    else if (l == v) { draw += p; bestDraw.Consider(p, l, v); }
                    else { away += p; bestAway.Consider(p, l, v); }
                }
            }

            var total = home + draw + away;
            var favorite = home >= draw && home >= away ? bestHome : draw >= away ? bestDraw : bestAway;
            return new MatchOutcome(home / total, draw / total, away / total, favorite.Local, favorite.Visitor);
        }

        private sealed class BestScore
        {
            private double _probability = -1;
            public int Local { get; private set; }
            public int Visitor { get; private set; }

            public void Consider(double probability, int local, int visitor)
            {
                var isMoreLikely = probability > _probability + Tolerance ||
                                   (Math.Abs(probability - _probability) <= Tolerance && local + visitor < Local + Visitor);
                if (!isMoreLikely) return;
                (_probability, Local, Visitor) = (probability, local, visitor);
            }
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
