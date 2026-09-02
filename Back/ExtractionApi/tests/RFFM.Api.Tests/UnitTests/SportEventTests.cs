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

        [Fact]
        public void SetLocationMapUrl_WithValidHttpsUrl_SetsValue()
        {
            var ev = NewBaseEvent();
            ev.SetLocationMapUrl("https://maps.google.com/?q=Campo+Municipal+Norte");
            Assert.Equal("https://maps.google.com/?q=Campo+Municipal+Norte", ev.LocationMapUrl);
        }

        [Fact]
        public void SetLocationMapUrl_WithValidHttpUrl_SetsValue()
        {
            var ev = NewBaseEvent();
            ev.SetLocationMapUrl("http://maps.google.com/?q=Campo");
            Assert.Equal("http://maps.google.com/?q=Campo", ev.LocationMapUrl);
        }

        [Fact]
        public void SetLocationMapUrl_WithNull_ClearsValue()
        {
            var ev = NewBaseEvent();
            ev.SetLocationMapUrl("https://maps.google.com/?q=Campo");
            ev.SetLocationMapUrl(null);
            Assert.Null(ev.LocationMapUrl);
        }

        [Fact]
        public void SetLocationMapUrl_WithEmptyString_ClearsValue()
        {
            var ev = NewBaseEvent();
            ev.SetLocationMapUrl("https://maps.google.com/?q=Campo");
            ev.SetLocationMapUrl(string.Empty);
            Assert.Null(ev.LocationMapUrl);
        }

        [Fact]
        public void SetLocationMapUrl_WithNonUrlString_Throws()
        {
            var ev = NewBaseEvent();
            Assert.Throws<ArgumentException>(() => ev.SetLocationMapUrl("not a url"));
        }

        [Fact]
        public void SetLocationMapUrl_WithRelativeUrl_Throws()
        {
            var ev = NewBaseEvent();
            Assert.Throws<ArgumentException>(() => ev.SetLocationMapUrl("/relative/path"));
        }

        [Fact]
        public void SetLocationMapUrl_WithNonHttpScheme_Throws()
        {
            var ev = NewBaseEvent();
            Assert.Throws<ArgumentException>(() => ev.SetLocationMapUrl("ftp://maps.google.com/?q=Campo"));
        }

        [Fact]
        public void SetLocationMapUrl_LongerThanMax_Throws()
        {
            var ev = NewBaseEvent();
            var tooLong = "https://maps.google.com/?q=" + new string('a', ValidationAssistancesConstants.MaxLocationMapUrlLength);
            Assert.Throws<ArgumentException>(() => ev.SetLocationMapUrl(tooLong));
        }

        [Fact]
        public void CreateNew_WithLocationMapUrl_SetsValue()
        {
            var ev = SportEvent.CreateNew(
                "Entrenamiento",
                DateTime.UtcNow.AddDays(1),
                DateTime.UtcNow.AddDays(1),
                null, null, "Campo Municipal Norte", null,
                2, "team-1", null,
                locationMapUrl: "https://maps.google.com/?q=Campo+Municipal+Norte");

            Assert.Equal("https://maps.google.com/?q=Campo+Municipal+Norte", ev.LocationMapUrl);
        }

        [Fact]
        public void CreateNew_WithoutLocationMapUrl_DefaultsToNull()
        {
            var ev = NewBaseEvent();
            Assert.Null(ev.LocationMapUrl);
        }
    }
}
