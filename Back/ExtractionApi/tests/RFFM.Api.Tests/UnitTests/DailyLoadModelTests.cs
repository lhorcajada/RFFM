using RFFM.Api.Features.Coaches.Players.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class DailyLoadModelTests
    {
        private static readonly DateTime Today = new(2026, 9, 24);
        private static readonly DailyLoadModel.Parameters FormParams = new(0.16, 4, 0.5, 3);

        private static DailyLoadModel.LoadEvent Event(DateTime date, double load, string? id = null) =>
            new(id ?? $"e{date:yyyyMMdd}{load}", date, 0, Array.Empty<string>(), 0, 1, load);

        private static DailyLoadModel.Result Simulate(DateTime start, params DailyLoadModel.LoadEvent[] events) =>
            DailyLoadModel.Simulate(start, Today, events, FormParams);

        // Satura hasta 100 con actividad diaria y luego descansa `restDays` días completos (hoy, sin
        // actividad todavía, no cuenta).
        private static double ValueAfterRest(int restDays)
        {
            var lastActivity = Today.AddDays(-(restDays + 1));
            var events = Enumerable.Range(0, 60).Select(i => Event(lastActivity.AddDays(-i), 10)).ToArray();
            return Simulate(lastActivity.AddDays(-59), events).Value;
        }

        [Fact]
        public void TodayWithoutActivityYet_IsNotCountedAsRestDay()
        {
            var result = Simulate(Today.AddDays(-10), Event(Today.AddDays(-1), 1));

            Assert.Equal(0, result.CurrentRestStreakDays);
        }

        [Fact]
        public void TodayWithoutActivityYet_DoesNotDecay()
        {
            var lastActivity = Today.AddDays(-5);
            var events = Enumerable.Range(0, 60).Select(i => Event(lastActivity.AddDays(-i), 10)).ToArray();

            var result = Simulate(lastActivity.AddDays(-59), events);

            Assert.Equal(4, result.CurrentRestStreakDays);
            Assert.Equal(100d, result.Value);
        }

        [Fact]
        public void TodayWithActivity_Counts()
        {
            var result = Simulate(Today.AddDays(-10), Event(Today.AddDays(-1), 1), Event(Today, 1));

            Assert.Equal(0, result.CurrentRestStreakDays);
            Assert.Equal(Today, result.Steps.First().Date);
        }

        [Fact]
        public void WithoutEvents_ValueIsZeroAndThereAreNoSteps()
        {
            var result = Simulate(Today.AddDays(-10));

            Assert.Equal(0d, result.Value);
            Assert.Empty(result.Steps);
        }

        [Fact]
        public void ActivityDay_AddsLoadWithExponentialSaturation()
        {
            var result = Simulate(Today, Event(Today, 1));

            Assert.Equal(100d * (1 - Math.Exp(-0.16)), result.Value, precision: 6);
        }

        [Fact]
        public void Value_NeverExceedsOneHundred()
        {
            var events = Enumerable.Range(0, 30).Select(i => Event(Today.AddDays(-i), 50)).ToArray();

            var result = Simulate(Today.AddDays(-29), events);

            Assert.InRange(result.Value, 0d, 100d);
        }

        [Theory]
        [InlineData(70, 36, 90, 18)]
        [InlineData(36, 70, 90, 18)]
        [InlineData(70, 36, 18, 90)]
        public void MoreTotalLoad_NeverGivesLowerValue_WhateverTheDistribution(int lowA, int lowB, int highA, int highB)
        {
            var start = Today.AddDays(-13);
            DailyLoadModel.Result Run(int a, int b) => Simulate(start,
                Event(start.AddDays(1), 1), Event(start.AddDays(3), 0.5), Event(start.AddDays(6), 1.5 * a / 70d),
                Event(start.AddDays(8), 1), Event(start.AddDays(10), 0.5), Event(start.AddDays(13), 1.5 * b / 70d));

            Assert.True(Run(highA, highB).Value >= Run(lowA, lowB).Value);
        }

        [Theory]
        [InlineData(4, 100)]
        [InlineData(5, 99.5)]
        [InlineData(7, 97)]
        [InlineData(14, 77.5)]
        [InlineData(21, 56.5)]
        [InlineData(28, 35.5)]
        public void RestDays_KeepValueDuringGraceAndThenDecayIncreasingly(int restDays, double expected)
        {
            Assert.Equal(expected, ValueAfterRest(restDays), precision: 3);
        }

        [Fact]
        public void SaturationWithModerateLoad_ReachesExactlyOneHundred_SoGraceDecayIsExact()
        {
            var lastActivity = Today.AddDays(-6);
            var events = Enumerable.Range(0, 120).Select(i => Event(lastActivity.AddDays(-i), 2.71)).ToArray();

            var result = Simulate(lastActivity.AddDays(-119), events);

            Assert.Equal(99.5, result.Value);
        }

        [Fact]
        public void Decay_NeverGoesBelowZero()
        {
            var result = Simulate(Today.AddDays(-80), Event(Today.AddDays(-80), 1));

            Assert.Equal(0d, result.Value);
        }

        [Fact]
        public void EventWithZeroLoad_ResetsRestStreakWithoutAddingValue()
        {
            var start = Today.AddDays(-8);
            var withZeroLoadEvent = Simulate(start, Event(start, 10), Event(start.AddDays(4), 0));
            var withoutIt = Simulate(start, Event(start, 10));

            Assert.Equal(3, withZeroLoadEvent.CurrentRestStreakDays);
            Assert.Equal(7, withoutIt.CurrentRestStreakDays);
            Assert.True(withZeroLoadEvent.Value > withoutIt.Value);
        }

        [Fact]
        public void SeveralEventsSameDay_AddTheirLoads()
        {
            var twoEvents = Simulate(Today, Event(Today, 1, "a"), Event(Today, 0.5, "b"));
            var oneEvent = Simulate(Today, Event(Today, 1.5));

            Assert.Equal(oneEvent.Value, twoEvents.Value, precision: 6);
            Assert.Equal(2, twoEvents.Steps.Single().Events.Length);
        }

        [Fact]
        public void EventsOutsideReplay_AreIgnored()
        {
            var result = Simulate(Today.AddDays(-5), Event(Today.AddDays(-6), 1), Event(Today.AddDays(1), 1));

            Assert.Equal(0d, result.Value);
            Assert.Empty(result.Steps);
        }

        [Fact]
        public void Steps_OneActivityPerActiveDayAndOneDecayPerStreakWithLoss_MostRecentFirst()
        {
            var start = Today.AddDays(-20);
            var result = Simulate(start, Event(start, 10), Event(start.AddDays(3), 1), Event(start.AddDays(12), 1));

            Assert.Collection(result.Steps,
                s => { Assert.Equal("Decay", s.Kind); Assert.Equal(start.AddDays(17), s.Date); Assert.Equal(Today.AddDays(-1), s.EndDate); },
                s => { Assert.Equal("Activity", s.Kind); Assert.Equal(start.AddDays(12), s.Date); },
                s => { Assert.Equal("Decay", s.Kind); Assert.Equal(start.AddDays(8), s.Date); Assert.Equal(start.AddDays(11), s.EndDate); },
                s => { Assert.Equal("Activity", s.Kind); Assert.Equal(start.AddDays(3), s.Date); },
                s => { Assert.Equal("Activity", s.Kind); Assert.Equal(start, s.Date); Assert.Equal(0d, s.ValueBefore); });
            Assert.Equal(7, result.CurrentRestStreakDays);
        }

        [Fact]
        public void Steps_ChainValueBeforeAndAfter()
        {
            var start = Today.AddDays(-20);
            var result = Simulate(start, Event(start, 10), Event(start.AddDays(12), 1));

            var chronological = result.Steps.Reverse().ToArray();
            for (var i = 1; i < chronological.Length; i++)
                Assert.Equal(chronological[i - 1].ValueAfter, chronological[i].ValueBefore, precision: 9);
            Assert.Equal(result.Value, result.Steps.First().ValueAfter, precision: 9);
        }
    }
}
