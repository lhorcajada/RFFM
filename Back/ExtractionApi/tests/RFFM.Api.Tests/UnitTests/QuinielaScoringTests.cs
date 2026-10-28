using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Teams;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class QuinielaScoringTests
    {
        private static readonly DateTime Now = new(2026, 10, 28, 10, 0, 0, DateTimeKind.Utc);
        private static readonly DateTime Day = new(2026, 11, 1, 12, 0, 0);

        // A 2-0 (1), B 1-1 (X), C 0-1 (2, Pleno 0-1, último válido), D aplazado y posterior a C.
        private static QuinielaScoring.MatchInfo[] Matches() =>
        [
            new("A", true, Day, 1, 2, 0),
            new("B", true, Day.AddHours(1), 2, 1, 1),
            new("C", true, Day.AddHours(2), 3, 0, 1),
            new("D", false, Day.AddHours(5), 4, null, null)
        ];

        private static int _users;

        private static QuinielaTicket Ticket(QuinielaSign a, QuinielaSign b, QuinielaSign c, int plenoHome, int plenoAway, bool paid = true)
        {
            var ticket = QuinielaTicket.Create("j1", $"u{++_users}",
                [new("A", a), new("B", b), new("C", c), new("D", QuinielaSign.Home)], plenoHome, plenoAway);
            if (paid)
                ticket.MarkPaid(QuinielaPaymentMethod.Cash, Now);
            return ticket;
        }

        private static QuinielaTicket Perfect(int plenoHome = 0, int plenoAway = 1, bool paid = true) =>
            Ticket(QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, plenoHome, plenoAway, paid);

        private static QuinielaTicket TwoHits() =>
            Ticket(QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Home, 3, 3);

        private static QuinielaTicket OneHit() =>
            Ticket(QuinielaSign.Home, QuinielaSign.Home, QuinielaSign.Home, 3, 3);

        private static IEnumerable<QuinielaTicket> Fillers(int count) =>
            Enumerable.Range(0, count).Select(_ => Ticket(QuinielaSign.Away, QuinielaSign.Home, QuinielaSign.Home, 3, 3));

        private static QuinielaScoring.Result Score(IEnumerable<QuinielaTicket> tickets, decimal carryIn = 0m) =>
            QuinielaScoring.Score(Matches(), tickets.ToList(), 1m, 55m, carryIn);

        private static QuinielaScoring.TicketScore Of(QuinielaScoring.Result result, QuinielaTicket ticket) =>
            result.Tickets.Single(t => t.TicketId == ticket.Id);

        [Fact]
        public void Score_AssignsHitsAndCategoriesIgnoringTheInvalidMatch()
        {
            var special = Perfect();
            var first = Perfect(plenoHome: 1);
            var second = TwoHits();
            var third = OneHit();
            var none = Ticket(QuinielaSign.Away, QuinielaSign.Home, QuinielaSign.Home, 3, 3);

            var result = Score([special, first, second, third, none]);

            Assert.Equal((3, QuinielaCategory.Special), (Of(result, special).Hits, Of(result, special).Category));
            Assert.Equal((3, QuinielaCategory.First), (Of(result, first).Hits, Of(result, first).Category));
            Assert.Equal((2, QuinielaCategory.Second), (Of(result, second).Hits, Of(result, second).Category));
            Assert.Equal((1, QuinielaCategory.Third), (Of(result, third).Hits, Of(result, third).Category));
            Assert.Equal((0, QuinielaCategory.None), (Of(result, none).Hits, Of(result, none).Category));
        }

        [Fact]
        public void Score_PlenoIsTheLastValidMatchByDateAndTime()
        {
            // Pleno 0-1 (partido C); si se tomara el aplazado D (sin goles) nadie lo acertaría.
            var ticket = Perfect(0, 1);

            var result = Score([ticket]);

            Assert.Equal(QuinielaCategory.Special, Of(result, ticket).Category);
        }

        [Fact]
        public void Score_PlenoGoalsAboveTwoCountAsM()
        {
            var matches = new[] { new QuinielaScoring.MatchInfo("A", true, Day, 1, 5, 4) };
            var ticket = QuinielaTicket.Create("j1", "u1", [new QuinielaPick("A", QuinielaSign.Home)], 3, 3);
            ticket.MarkPaid(QuinielaPaymentMethod.Cash, Now);

            var result = QuinielaScoring.Score(matches, [ticket], 1m, 55m, 0m);

            Assert.Equal(QuinielaCategory.Special, result.Tickets.Single().Category);
        }

        [Fact]
        public void Score_PostponedMatchPickDoesNotCountAsHitOrMiss()
        {
            // El pronóstico de D (1) no cuenta: con A, B y C acertados sigue siendo 1ª categoría.
            var ticket = Perfect(3, 3);

            var result = Score([ticket]);

            Assert.Equal(3, Of(result, ticket).Hits);
            Assert.Equal(QuinielaCategory.First, Of(result, ticket).Category);
        }

        [Fact]
        public void Score_MissingPickCountsAsMiss()
        {
            var ticket = QuinielaTicket.Create("j1", "u1", [new QuinielaPick("A", QuinielaSign.Home)], 3, 3);
            ticket.MarkPaid(QuinielaPaymentMethod.Cash, Now);

            var result = Score([ticket]);

            Assert.Equal(1, result.Tickets.Single().Hits);
            Assert.Equal(QuinielaCategory.Third, result.Tickets.Single().Category);
        }

        // Con 20 cobrados la bolsa es 11,00: Especial 2,14 / 1ª 4,57 / 2ª 2,14 / 3ª 2,14 (pesos 7,5/16/7,5/7,5 sobre 38,5).

        [Fact]
        public void Weights_AreRescaledToTheFourCategoriesAndSumTo38_5()
        {
            Assert.Equal(7.5m, QuinielaScoring.WeightFor(QuinielaCategory.Special));
            Assert.Equal(16m, QuinielaScoring.WeightFor(QuinielaCategory.First));
            Assert.Equal(7.5m, QuinielaScoring.WeightFor(QuinielaCategory.Second));
            Assert.Equal(7.5m, QuinielaScoring.WeightFor(QuinielaCategory.Third));
            Assert.Equal(38.5m, QuinielaScoring.TotalWeight);
        }

        [Fact]
        public void Score_SplitsCategoryPrizeEquallyAmongWinners()
        {
            // 2ª = 2,14 entre 2 ganadores -> 1,07 cada uno (Especial y 1ª desiertas no limitan).
            var winners = new[] { TwoHits(), TwoHits() };

            var result = Score(winners.Concat(Fillers(18)));

            Assert.All(winners, w => Assert.Equal(1.07m, Of(result, w).Prize));
        }

        [Fact]
        public void Score_WinnerReceivesWholeCategoryPrizeWhenAlone()
        {
            var winner = Perfect();

            var result = Score([winner, .. Fillers(19)]);

            Assert.Equal(2.14m, Of(result, winner).Prize);
        }

        [Fact]
        public void Score_FirstCategoryUsesItsOwnWeight()
        {
            var winner = Perfect(plenoHome: 1);

            var result = Score([winner, .. Fillers(19)]);

            Assert.Equal(4.57m, Of(result, winner).Prize);
        }

        [Fact]
        public void Score_RoundsShareDownToTheCentAndSendsRemainderToCarryOut()
        {
            // 3ª = 2,14 + 2ª desierta 2,14 = 4,28 entre 3 ganadores -> 1,42 cada uno, resto 0,02.
            var winners = new[] { OneHit(), OneHit(), OneHit() };

            var result = Score(winners.Concat(Fillers(17)));

            Assert.All(winners, w => Assert.Equal(1.42m, Of(result, w).Prize));
            Assert.Equal(11m - 3 * 1.42m, result.CarryOut);
        }

        [Fact]
        public void Score_EmptySpecialCategoryGoesToCarryOut()
        {
            var winner = Perfect(plenoHome: 1);

            var result = Score([winner, .. Fillers(19)]);

            Assert.Equal(11m - 4.57m, result.CarryOut);
        }

        [Fact]
        public void Score_EmptyFirstCategoryGoesToCarryOut()
        {
            var winner = Perfect();

            var result = Score([winner, .. Fillers(19)]);

            Assert.Equal(11m - 2.14m, result.CarryOut);
        }

        [Fact]
        public void Score_EmptySecondCategoryAddsItsAmountToTheThird()
        {
            var winner = OneHit();

            var result = Score([winner, .. Fillers(19)]);

            Assert.Equal(4.28m, Of(result, winner).Prize);
            Assert.Equal(11m - 4.28m, result.CarryOut);
        }

        [Fact]
        public void Score_EmptyThirdCategoryAfterEmptySecondGoesEntirelyToCarryOut()
        {
            var result = Score(Fillers(20));

            Assert.Equal(11m, result.CarryOut);
        }

        [Fact]
        public void Score_SecondWinnersDoNotLoseTheirAmountWhenThirdIsEmpty()
        {
            var winner = TwoHits();

            var result = Score([winner, .. Fillers(19)]);

            Assert.Equal(2.14m, Of(result, winner).Prize);
            Assert.Equal(11m - 2.14m, result.CarryOut);
        }

        [Fact]
        public void Score_LowerCategoryPrizeNeverExceedsAHigherOne_SharedBetweenBoth()
        {
            // Especial 2,14 (1 ganador) y 1ª 4,57 (1 ganador): la 1ª superaría a la Especial -> (2,14+4,57)/2 = 3,35.
            var special = Perfect();
            var first = Perfect(plenoHome: 1);

            var result = Score([special, first, .. Fillers(18)]);

            Assert.Equal(3.35m, Of(result, special).Prize);
            Assert.Equal(3.35m, Of(result, first).Prize);
            Assert.Equal(11m - 6.70m, result.CarryOut);
        }

        [Fact]
        public void Score_ThirdAboveSecondMergesFundsAndShareAmongBoth()
        {
            // 2ª: 2,14 / 5 = 0,42; 3ª: 2,14 / 1 = 2,14 > 0,42 -> (2,14+2,14)/6 = 0,71 cada uno.
            var seconds = Enumerable.Range(0, 5).Select(_ => TwoHits()).ToList();
            var third = OneHit();

            var result = Score([.. seconds, third, .. Fillers(14)]);

            Assert.All(seconds, s => Assert.Equal(0.71m, Of(result, s).Prize));
            Assert.Equal(0.71m, Of(result, third).Prize);
        }

        [Fact]
        public void Score_CascadingMergeComparesAgainstEveryHigherCategory()
        {
            // Especial 1 ganador (2,14), 1ª 3 ganadores (4,57/3=1,52), 3ª 1 ganador (4,28 con la 2ª desierta).
            // 3ª (4,28) > 1ª (1,52) -> 1ª+3ª: 8,85/4 = 2,21; sigue > Especial? 2,21 > 2,14 -> todo junto: 11,... / 5.
            var special = Perfect();
            var firsts = new[] { Perfect(1), Perfect(1), Perfect(1) };
            var third = OneHit();

            var result = Score([special, .. firsts, third, .. Fillers(15)]);

            // Fondos: 2,14 + 4,57 + 4,28 = 10,99 entre 5 -> 2,19.
            Assert.All(new[] { special }.Concat(firsts).Append(third), t => Assert.Equal(2.19m, Of(result, t).Prize));
        }

        [Fact]
        public void Score_EmptyCategoriesGoToCarryOut()
        {
            var result = Score(Fillers(20));

            Assert.Equal(11m, result.CarryOut);
            Assert.All(result.Tickets, t => Assert.Equal(0m, t.Prize));
        }

        [Fact]
        public void Score_PrizePoolIsCollectedTimesPercentPlusCarryIn()
        {
            var result = Score(Fillers(20), carryIn: 5m);

            Assert.Equal(20m, result.Collected);
            Assert.Equal(16m, result.PrizePool);
        }

        [Fact]
        public void Score_RemainingPercentGoesToTeamFund()
        {
            var result = Score(Fillers(8));

            Assert.Equal(8m, result.Collected);
            Assert.Equal(3.6m, result.FundAmount);
        }

        [Fact]
        public void Score_CarryInIsNotAddedToTeamFund()
        {
            var result = Score(Fillers(8), carryIn: 10m);

            Assert.Equal(3.6m, result.FundAmount);
        }

        [Fact]
        public void Score_PendingTicketsAreExcludedFromCollectedAndPrizes()
        {
            var unpaidPerfect = Perfect(paid: false);
            var paid = Perfect();

            var result = Score([unpaidPerfect, paid]);

            Assert.Equal(1m, result.Collected);
            Assert.Equal(QuinielaCategory.None, Of(result, unpaidPerfect).Category);
            Assert.Equal(0m, Of(result, unpaidPerfect).Prize);
            Assert.True(Of(result, paid).Prize > 0m);
        }

        [Fact]
        public void Score_PrizesPlusCarryOutEqualPrizePool()
        {
            var tickets = new[] { Perfect(), Perfect(1), TwoHits(), OneHit(), OneHit() }.Concat(Fillers(15)).ToList();

            var result = Score(tickets, carryIn: 2.5m);

            Assert.Equal(result.PrizePool, result.Tickets.Sum(t => t.Prize) + result.CarryOut);
        }

        [Fact]
        public void Score_ValidMatchWithoutGoals_Throws()
        {
            var matches = new[] { new QuinielaScoring.MatchInfo("A", true, Day, 1, null, null) };
            var ticket = QuinielaTicket.Create("j1", "u1", [new QuinielaPick("A", QuinielaSign.Home)], 0, 0);

            var ex = Assert.Throws<DomainException>(() => QuinielaScoring.Score(matches, [ticket], 1m, 55m, 0m));

            Assert.Equal(ErrorCodes.QuinielaMatchesNotFinished, ex.Code);
        }

        [Fact]
        public void Score_WithoutValidMatches_Throws()
        {
            var matches = new[] { new QuinielaScoring.MatchInfo("A", false, Day, 1, null, null) };

            var ex = Assert.Throws<DomainException>(() => QuinielaScoring.Score(matches, [], 1m, 55m, 0m));

            Assert.Equal(ErrorCodes.QuinielaNoValidMatches, ex.Code);
        }

        [Fact]
        public void SignFromGoals_HomeWin() => Assert.Equal(QuinielaSign.Home, QuinielaSign.FromGoals(1, 0));

        [Fact]
        public void SignFromGoals_Draw() => Assert.Equal(QuinielaSign.Draw, QuinielaSign.FromGoals(2, 2));

        [Fact]
        public void SignFromGoals_AwayWin() => Assert.Equal(QuinielaSign.Away, QuinielaSign.FromGoals(0, 3));
    }
}
