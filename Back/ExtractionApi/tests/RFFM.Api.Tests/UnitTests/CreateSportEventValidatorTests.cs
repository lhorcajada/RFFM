#nullable enable
using System;
using RFFM.Api.Features.Coaches.SportEvents.Commands;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class CreateSportEventValidatorTests
    {
        private readonly CreateSportEventValidator _validator = new();

        private static CreateSportEventRequest BaseRequest(RecurrenceRequest? recurrence) => new(
            Name: "Entrenamiento",
            EveDateTime: new DateTime(2026, 8, 3, 18, 0, 0, DateTimeKind.Utc),
            StartTime: new DateTime(2026, 8, 3, 18, 0, 0, DateTimeKind.Utc),
            EndTime: null,
            ArrivalDate: null,
            Location: null,
            Description: null,
            EventTypeId: 2,
            TeamId: "team-1",
            RivalId: null,
            IsHomeMatch: null,
            CodActa: null,
            Recurrence: recurrence
        );

        [Fact]
        public void Validate_WithoutRecurrence_Succeeds()
        {
            var result = _validator.Validate(BaseRequest(null));
            Assert.True(result.IsValid);
        }

        [Fact]
        public void Validate_WithValidWeeklyRecurrence_Succeeds()
        {
            var request = BaseRequest(new RecurrenceRequest("weekly", new DateTime(2026, 8, 24)));
            var result = _validator.Validate(request);
            Assert.True(result.IsValid);
        }

        [Fact]
        public void Validate_WithUnknownFrequency_Fails()
        {
            var request = BaseRequest(new RecurrenceRequest("yearly", new DateTime(2026, 8, 24)));
            var result = _validator.Validate(request);
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_WithEndDateBeforeEventDate_Fails()
        {
            var request = BaseRequest(new RecurrenceRequest("weekly", new DateTime(2026, 8, 1)));
            var result = _validator.Validate(request);
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_WithExactlyFiftyTwoInstances_Succeeds()
        {
            var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var request = BaseRequest(new RecurrenceRequest("daily", start.AddDays(51))) with { EveDateTime = start, StartTime = start };
            var result = _validator.Validate(request);
            Assert.True(result.IsValid);
        }

        [Fact]
        public void Validate_WithFiftyThreeInstances_Fails()
        {
            var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var request = BaseRequest(new RecurrenceRequest("daily", start.AddDays(52))) with { EveDateTime = start, StartTime = start };
            var result = _validator.Validate(request);
            Assert.False(result.IsValid);
        }
    }
}
