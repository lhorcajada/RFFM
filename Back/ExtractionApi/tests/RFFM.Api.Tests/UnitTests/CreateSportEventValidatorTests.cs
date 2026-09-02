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
            Recurrence: recurrence,
            NewRival: null
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

        [Fact]
        public void Validate_WithoutEveDateTimeOrStartTime_AndNoRecurrence_Succeeds()
        {
            var request = BaseRequest(null) with { EveDateTime = null, StartTime = null };
            var result = _validator.Validate(request);
            Assert.True(result.IsValid);
        }

        [Fact]
        public void Validate_WithRecurrence_AndNoEveDateTime_Fails()
        {
            var request = BaseRequest(new RecurrenceRequest("weekly", new DateTime(2026, 8, 24)))
                with
            { EveDateTime = null };
            var result = _validator.Validate(request);
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.ErrorMessage.Contains("recurrencia requiere una fecha"));
        }

        [Fact]
        public void Validate_WithRivalIdAndNewRivalBoth_Fails()
        {
            var request = BaseRequest(null) with
            {
                RivalId = "rival-1",
                NewRival = new NewRivalRequest("CD Rival", null, null)
            };
            var result = _validator.Validate(request);
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_WithOnlyNewRival_Succeeds()
        {
            var request = BaseRequest(null) with
            {
                RivalId = null,
                NewRival = new NewRivalRequest("CD Rival", null, null)
            };
            var result = _validator.Validate(request);
            Assert.True(result.IsValid);
        }

        [Fact]
        public void Validate_WithNewRivalMissingName_Fails()
        {
            var request = BaseRequest(null) with
            {
                RivalId = null,
                NewRival = new NewRivalRequest("", null, null)
            };
            var result = _validator.Validate(request);
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_WithNeitherRivalIdNorNewRival_Succeeds()
        {
            var request = BaseRequest(null) with { RivalId = null, NewRival = null };
            var result = _validator.Validate(request);
            Assert.True(result.IsValid);
        }

        [Fact]
        public void Validate_WithValidLocationMapUrl_Succeeds()
        {
            var request = BaseRequest(null) with { LocationMapUrl = "https://maps.google.com/?q=Campo+Municipal+Norte" };
            var result = _validator.Validate(request);
            Assert.True(result.IsValid);
        }

        [Fact]
        public void Validate_WithMalformedLocationMapUrl_Fails()
        {
            var request = BaseRequest(null) with { LocationMapUrl = "not a url" };
            var result = _validator.Validate(request);
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateSportEventRequest.LocationMapUrl));
        }

        [Fact]
        public void Validate_WithNullLocationMapUrl_Succeeds()
        {
            var request = BaseRequest(null) with { LocationMapUrl = null };
            var result = _validator.Validate(request);
            Assert.True(result.IsValid);
        }
    }
}
