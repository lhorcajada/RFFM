#nullable enable
using System;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.Assistances;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class AvailabilityRequestTests
    {
        private static readonly DateTime Now = new(2026, 10, 9, 10, 0, 0, DateTimeKind.Utc);

        [Fact]
        public void Create_starts_as_requested_without_response()
        {
            var request = AvailabilityRequest.Create("event-1", "tp-1", Now);

            Assert.Equal(AvailabilityRequestStatus.Requested.Id, request.StatusId);
            Assert.Equal(Now, request.RequestedAt);
            Assert.Null(request.RespondedAt);
        }

        [Fact]
        public void Create_requires_event_and_player()
        {
            Assert.ThrowsAny<ArgumentException>(() => AvailabilityRequest.Create("", "tp-1", Now));
            Assert.ThrowsAny<ArgumentException>(() => AvailabilityRequest.Create("event-1", " ", Now));
        }

        [Fact]
        public void MarkAvailable_from_requested_sets_available_and_response_time()
        {
            var request = AvailabilityRequest.Create("event-1", "tp-1", Now);

            request.MarkAvailable(Now.AddHours(1));

            Assert.Equal(AvailabilityRequestStatus.Available.Id, request.StatusId);
            Assert.Equal(Now.AddHours(1), request.RespondedAt);
        }

        [Fact]
        public void MarkUnavailable_from_available_sets_unavailable()
        {
            var request = AvailabilityRequest.Create("event-1", "tp-1", Now);
            request.MarkAvailable(Now.AddHours(1));

            request.MarkUnavailable(Now.AddHours(2));

            Assert.Equal(AvailabilityRequestStatus.Unavailable.Id, request.StatusId);
            Assert.Equal(Now.AddHours(2), request.RespondedAt);
        }

        [Fact]
        public void MarkAvailable_from_unavailable_is_rejected()
        {
            var request = AvailabilityRequest.Create("event-1", "tp-1", Now);
            request.MarkUnavailable(Now.AddHours(1));

            Assert.Throws<DomainException>(() => request.MarkAvailable(Now.AddHours(2)));
        }

        [Fact]
        public void Reopen_from_unavailable_goes_back_to_requested()
        {
            var request = AvailabilityRequest.Create("event-1", "tp-1", Now);
            request.MarkUnavailable(Now.AddHours(1));

            request.Reopen(Now.AddDays(1));

            Assert.Equal(AvailabilityRequestStatus.Requested.Id, request.StatusId);
            Assert.Equal(Now.AddDays(1), request.RequestedAt);
            Assert.Null(request.RespondedAt);
        }

        [Fact]
        public void Reopen_from_requested_is_rejected()
        {
            var request = AvailabilityRequest.Create("event-1", "tp-1", Now);

            Assert.Throws<DomainException>(() => request.Reopen(Now.AddDays(1)));
        }

        [Fact]
        public void Status_from_id_resolves_names()
        {
            Assert.Equal("Available", AvailabilityRequestStatus.From(2).Name);
            Assert.Throws<ArgumentException>(() => AvailabilityRequestStatus.From(99));
        }
    }
}
