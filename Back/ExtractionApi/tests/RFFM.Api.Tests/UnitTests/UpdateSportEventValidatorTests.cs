#nullable enable
using System;
using RFFM.Api.Features.Coaches.SportEvents.Commands;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class UpdateSportEventValidatorTests
    {
        private readonly UpdateSportEventValidator _validator = new();

        private static UpdateSportEventRequest BaseRequest(string? locationMapUrl) => new(
            Name: "Entrenamiento",
            EveDateTime: new DateTime(2026, 8, 3, 18, 0, 0, DateTimeKind.Utc),
            StartTime: new DateTime(2026, 8, 3, 18, 0, 0, DateTimeKind.Utc),
            EndTime: null,
            ArrivalDate: null,
            Location: "Campo Municipal Norte",
            LocationMapUrl: locationMapUrl,
            Description: null,
            EventTypeId: 2,
            RivalId: null,
            IsHomeMatch: null,
            CodActa: null
        );

        [Fact]
        public void Validate_WithValidLocationMapUrl_Succeeds()
        {
            var result = _validator.Validate(BaseRequest("https://maps.google.com/?q=Campo+Municipal+Norte"));
            Assert.True(result.IsValid);
        }

        [Fact]
        public void Validate_WithMalformedLocationMapUrl_Fails()
        {
            var result = _validator.Validate(BaseRequest("not a url"));
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == nameof(UpdateSportEventRequest.LocationMapUrl));
        }

        [Fact]
        public void Validate_WithNullLocationMapUrl_Succeeds()
        {
            var result = _validator.Validate(BaseRequest(null));
            Assert.True(result.IsValid);
        }
    }
}
