using FluentValidation;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class GetEventAttendanceSummaryValidatorTests
    {
        private readonly GetEventAttendanceSummary.Validator _validator;

        public GetEventAttendanceSummaryValidatorTests()
        {
            _validator = new GetEventAttendanceSummary.Validator();
        }

        [Fact]
        public void Validator_RequiresTeamId()
        {
            // Arrange
            var query = new GetEventAttendanceSummary.EventAttendanceSummaryQuery
            {
                TeamId = "",
                EventIds = new[] { "event-1" }
            };

            // Act
            var result = _validator.Validate(query);

            // Assert
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == "TeamId");
        }

        [Fact]
        public void Validator_RequiresEventIds()
        {
            // Arrange
            var query = new GetEventAttendanceSummary.EventAttendanceSummaryQuery
            {
                TeamId = "team-1",
                EventIds = Array.Empty<string>()
            };

            // Act
            var result = _validator.Validate(query);

            // Assert
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == "EventIds");
        }

        [Fact]
        public void Validator_RejectsMoreThan50EventIds()
        {
            // Arrange
            var eventIds = Enumerable.Range(1, 51).Select(i => $"event-{i}").ToArray();
            var query = new GetEventAttendanceSummary.EventAttendanceSummaryQuery
            {
                TeamId = "team-1",
                EventIds = eventIds
            };

            // Act
            var result = _validator.Validate(query);

            // Assert
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == "EventIds");
        }

        [Fact]
        public void Validator_AcceptsValidCommand()
        {
            // Arrange
            var query = new GetEventAttendanceSummary.EventAttendanceSummaryQuery
            {
                TeamId = "team-1",
                EventIds = new[] { "event-1", "event-2", "event-3" }
            };

            // Act
            var result = _validator.Validate(query);

            // Assert
            Assert.True(result.IsValid);
        }
    }
}
