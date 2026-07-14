#nullable enable
using System;
using RFFM.Api.Domain.Aggregates.Assistances;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class EventRecurrenceTests
    {
        [Fact]
        public void Create_WithValidData_Succeeds()
        {
            var recurrence = EventRecurrence.Create(RecurrenceFrequency.FromCode("weekly"), DateTime.UtcNow.AddMonths(1), "event-1", 4);
            Assert.Equal(2, recurrence.FrequencyId);
            Assert.Equal("event-1", recurrence.MasterEventId);
            Assert.Equal(4, recurrence.InstanceCount);
        }

        [Fact]
        public void Create_WithInstanceCountAboveCap_Throws()
        {
            Assert.Throws<ArgumentException>(() =>
                EventRecurrence.Create(RecurrenceFrequency.FromCode("daily"), DateTime.UtcNow.AddYears(1), "event-1", 53));
        }

        [Fact]
        public void Create_WithEmptyMasterEventId_Throws()
        {
            Assert.Throws<ArgumentException>(() =>
                EventRecurrence.Create(RecurrenceFrequency.FromCode("daily"), DateTime.UtcNow.AddDays(10), "", 5));
        }
    }
}
