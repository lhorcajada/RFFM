#nullable enable
using System;
using RFFM.Api.Domain.Aggregates.Assistances;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class SportEventTests
    {
        private static SportEvent NewBaseEvent() =>
            SportEvent.CreateNew(
                "Entrenamiento",
                DateTime.UtcNow.AddDays(1),
                DateTime.UtcNow.AddDays(1),
                null, null, null, null,
                2, "team-1", null);

        [Fact]
        public void SetEveDateTime_WithNull_DoesNotThrow_AndClearsValue()
        {
            var ev = NewBaseEvent();
            ev.SetEveDateTime(null);
            Assert.Null(ev.EveDateTime);
        }

        [Fact]
        public void SetEveDateTime_WithDefault_Throws()
        {
            var ev = NewBaseEvent();
            Assert.Throws<ArgumentException>(() => ev.SetEveDateTime(default(DateTime)));
        }

        [Fact]
        public void SetEveDateTime_WithPastDate_Throws()
        {
            var ev = NewBaseEvent();
            Assert.Throws<ArgumentException>(() => ev.SetEveDateTime(DateTime.UtcNow.AddDays(-1)));
        }

        [Fact]
        public void SetEveDateTime_WithFutureDate_SetsValue()
        {
            var ev = NewBaseEvent();
            var future = DateTime.UtcNow.AddDays(5);
            ev.SetEveDateTime(future);
            Assert.Equal(future, ev.EveDateTime);
        }

        [Fact]
        public void SetStartTime_WithNull_DoesNotThrow_AndClearsValue()
        {
            var ev = NewBaseEvent();
            ev.SetStartTime(null);
            Assert.Null(ev.StartTime);
        }

        [Fact]
        public void SetStartTime_WithDefault_Throws()
        {
            var ev = NewBaseEvent();
            Assert.Throws<ArgumentException>(() => ev.SetStartTime(default(DateTime)));
        }

        [Fact]
        public void SetStartTime_WithPastDate_Throws()
        {
            var ev = NewBaseEvent();
            Assert.Throws<ArgumentException>(() => ev.SetStartTime(DateTime.UtcNow.AddDays(-1)));
        }

        [Fact]
        public void SetStartTime_AfterEndTime_Throws()
        {
            var ev = NewBaseEvent();
            ev.SetEndTime(DateTime.UtcNow.AddDays(2));
            Assert.Throws<ArgumentException>(() => ev.SetStartTime(DateTime.UtcNow.AddDays(3)));
        }

        [Fact]
        public void SetEndTime_WithNull_DoesNotThrow_WhenStartTimeIsNull()
        {
            var ev = NewBaseEvent();
            ev.SetStartTime(null);
            var record = Record.Exception(() => ev.SetEndTime(null));
            Assert.Null(record);
        }

        [Fact]
        public void SetEndTime_BeforeOrEqualStartTime_Throws_WhenStartTimeHasValue()
        {
            var ev = NewBaseEvent();
            var start = DateTime.UtcNow.AddDays(2);
            ev.SetStartTime(start);
            Assert.Throws<ArgumentException>(() => ev.SetEndTime(start));
        }

        [Fact]
        public void SetEndTime_DoesNotThrow_WhenStartTimeIsNull()
        {
            var ev = NewBaseEvent();
            ev.SetStartTime(null);
            var record = Record.Exception(() => ev.SetEndTime(DateTime.UtcNow.AddDays(1)));
            Assert.Null(record);
        }

        [Fact]
        public void CreateNew_AllowsNullEveDateTimeAndStartTime()
        {
            var ev = SportEvent.CreateNew(
                "Entrenamiento sin fecha",
                null,
                null,
                null, null, null, null,
                2, "team-1", null);

            Assert.Null(ev.EveDateTime);
            Assert.Null(ev.StartTime);
        }
    }
}
