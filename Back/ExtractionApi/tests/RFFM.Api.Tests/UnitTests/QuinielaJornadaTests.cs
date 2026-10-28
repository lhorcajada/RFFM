using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Teams;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class QuinielaJornadaTests
    {
        private static readonly DateTime Kickoff = new(2026, 11, 1, 11, 0, 0, DateTimeKind.Utc);

        private static QuinielaJornada NewJornada(decimal carryIn = 0m) =>
            QuinielaJornada.Create("team1", "round1", carryIn, 1m, 55m);

        [Fact]
        public void Create_StartsOpenWithGivenCarryIn()
        {
            var jornada = NewJornada(2.5m);

            Assert.Equal(QuinielaJornadaStatus.Open, jornada.Status);
            Assert.Equal(2.5m, jornada.CarryIn);
            Assert.Equal(1m, jornada.Price);
            Assert.Equal(55m, jornada.PrizePercent);
            Assert.Null(jornada.SettledAt);
        }

        [Theory]
        [InlineData("", "round1")]
        [InlineData("team1", " ")]
        public void Create_WithoutIds_Throws(string teamId, string roundId) =>
            Assert.Throws<ArgumentException>(() => QuinielaJornada.Create(teamId, roundId, 0m, 1m, 55m));

        [Theory]
        [InlineData(0, 55, 0)]
        [InlineData(1, 101, 0)]
        [InlineData(1, -1, 0)]
        [InlineData(1, 55, -0.01)]
        public void Create_WithInvalidAmounts_Throws(double price, double prizePercent, double carryIn) =>
            Assert.Throws<DomainException>(() =>
                QuinielaJornada.Create("team1", "round1", (decimal)carryIn, (decimal)price, (decimal)prizePercent));

        [Fact]
        public void EnsurePicksOpen_BeforeFirstKickoff_DoesNotThrow() =>
            NewJornada().EnsurePicksOpen(Kickoff, Kickoff.AddMinutes(-1));

        [Fact]
        public void EnsurePicksOpen_AtFirstKickoff_Throws()
        {
            var ex = Assert.Throws<DomainException>(() => NewJornada().EnsurePicksOpen(Kickoff, Kickoff));

            Assert.Equal(ErrorCodes.QuinielaPicksClosed, ex.Code);
        }

        [Fact]
        public void EnsurePicksOpen_WithoutScheduledMatch_DoesNotThrow() =>
            NewJornada().EnsurePicksOpen(null, Kickoff);

        [Fact]
        public void EnsurePicksOpen_WhenSettled_Throws()
        {
            var jornada = NewJornada();
            jornada.Settle(0m, Kickoff);

            Assert.Throws<DomainException>(() => jornada.EnsurePicksOpen(Kickoff, Kickoff.AddDays(-3)));
        }

        [Fact]
        public void Settle_StoresCarryOutAndStatus()
        {
            var jornada = NewJornada();

            jornada.Settle(3.3m, Kickoff);

            Assert.Equal(QuinielaJornadaStatus.Settled, jornada.Status);
            Assert.Equal(3.3m, jornada.CarryOut);
            Assert.Equal(Kickoff, jornada.SettledAt);
        }

        [Fact]
        public void Settle_Twice_Throws()
        {
            var jornada = NewJornada();
            jornada.Settle(0m, Kickoff);

            var ex = Assert.Throws<DomainException>(() => jornada.Settle(0m, Kickoff));

            Assert.Equal(ErrorCodes.QuinielaAlreadySettled, ex.Code);
        }

        [Fact]
        public void KickoffUtc_ConvertsMadridWinterTime() =>
            Assert.Equal(new DateTime(2026, 11, 1, 11, 0, 0, DateTimeKind.Utc),
                QuinielaSchedule.KickoffUtc(new DateOnly(2026, 11, 1), new TimeOnly(12, 0)));

        [Theory]
        [InlineData("2026-11-01", "2026-10-30T23:00:00Z")] // domingo -> viernes anterior, hora de invierno
        [InlineData("2026-10-31", "2026-10-30T23:00:00Z")] // sábado
        [InlineData("2026-10-30", "2026-10-30T23:00:00Z")] // viernes
        [InlineData("2026-11-02", "2026-11-06T23:00:00Z")] // lunes -> viernes de esa semana
        [InlineData("2026-09-26", "2026-09-25T22:00:00Z")] // hora de verano
        public void PaymentDeadlineUtc_IsFirstInstantAfterFriday2359Madrid(string firstMatchDate, string expectedUtc) =>
            Assert.Equal(DateTime.Parse(expectedUtc, null, System.Globalization.DateTimeStyles.RoundtripKind),
                QuinielaSchedule.PaymentDeadlineUtc(DateOnly.Parse(firstMatchDate)));
    }
}
