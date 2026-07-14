#nullable enable
using System;
using System.Linq;
using RFFM.Api.Domain.Aggregates.Assistances;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class RecurrenceSchedulerTests
    {
        [Fact]
        public void GenerateDates_Daily_StepsByOneDayInclusiveOfEndDate()
        {
            var start = new DateTime(2026, 8, 1, 18, 0, 0, DateTimeKind.Utc);
            var end = new DateTime(2026, 8, 4, 0, 0, 0, DateTimeKind.Utc); // date-only end bound
            var dates = RecurrenceScheduler.GenerateDates(start, RecurrenceFrequency.FromCode("daily"), end);
            Assert.Equal(4, dates.Count); // Aug 1, 2, 3, 4 (all with 18:00 time-of-day, <= end-of-day Aug 4)
            Assert.Equal(start, dates[0]);
        }

        [Fact]
        public void GenerateDates_Weekly_StepsBySevenDays()
        {
            var start = new DateTime(2026, 8, 3, 18, 0, 0, DateTimeKind.Utc);
            var end = new DateTime(2026, 8, 24, 0, 0, 0, DateTimeKind.Utc);
            var dates = RecurrenceScheduler.GenerateDates(start, RecurrenceFrequency.FromCode("weekly"), end);
            Assert.Equal(new[] { 3, 10, 17, 24 }, dates.Select(d => d.Day).ToArray());
        }

        [Fact]
        public void GenerateDates_Monthly_StepsByCalendarMonth()
        {
            var start = new DateTime(2026, 1, 15, 10, 0, 0, DateTimeKind.Utc);
            var end = new DateTime(2026, 4, 20, 0, 0, 0, DateTimeKind.Utc);
            var dates = RecurrenceScheduler.GenerateDates(start, RecurrenceFrequency.FromCode("monthly"), end);
            Assert.Equal(new[] { 1, 2, 3, 4 }, dates.Select(d => d.Month).ToArray());
        }

        [Fact]
        public void GenerateDates_ExactlyFiftyTwoInstances_ReturnsFiftyTwo()
        {
            var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var end = start.AddDays(51); // 52 daily occurrences: day 0..51
            var dates = RecurrenceScheduler.GenerateDates(start, RecurrenceFrequency.FromCode("daily"), end);
            Assert.Equal(52, dates.Count);
        }

        [Fact]
        public void GenerateDates_FiftyThreeInstances_ReturnsFiftyThree_CapEnforcedElsewhere()
        {
            // GenerateDates itself does not cap — capping/rejection is the validator's job (design.md §5).
            var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var end = start.AddDays(52); // 53 daily occurrences
            var dates = RecurrenceScheduler.GenerateDates(start, RecurrenceFrequency.FromCode("daily"), end);
            Assert.Equal(53, dates.Count);
        }

        [Fact]
        public void GenerateDates_EndDateBeforeStart_ReturnsEmpty()
        {
            var start = new DateTime(2026, 8, 10, 0, 0, 0, DateTimeKind.Utc);
            var end = new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc);
            var dates = RecurrenceScheduler.GenerateDates(start, RecurrenceFrequency.FromCode("weekly"), end);
            Assert.Empty(dates);
        }
    }
}
