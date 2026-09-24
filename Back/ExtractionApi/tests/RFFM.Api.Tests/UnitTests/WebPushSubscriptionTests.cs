using System;
using RFFM.Api.Domain.Entities.WebPushNotifications;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class WebPushSubscriptionTests
    {
        [Fact]
        public void Create_WithValidData_Should_Be_Successful()
        {
            var subscription = WebPushSubscription.Create(
                userId: "user-1",
                endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
                p256dhKey: "p256dh-key",
                authKey: "auth-key");

            Assert.Equal("user-1", subscription.UserId);
            Assert.Equal("https://fcm.googleapis.com/fcm/send/abc123", subscription.Endpoint);
            Assert.Equal("p256dh-key", subscription.P256dhKey);
            Assert.Equal("auth-key", subscription.AuthKey);
            Assert.True(subscription.CreatedAt <= DateTime.UtcNow);
        }

        [Theory]
        [InlineData(null, "endpoint", "p256dh", "auth")]
        [InlineData("", "endpoint", "p256dh", "auth")]
        [InlineData("user-1", null, "p256dh", "auth")]
        [InlineData("user-1", "", "p256dh", "auth")]
        [InlineData("user-1", "endpoint", null, "auth")]
        [InlineData("user-1", "endpoint", "", "auth")]
        [InlineData("user-1", "endpoint", "p256dh", null)]
        [InlineData("user-1", "endpoint", "p256dh", "")]
        public void Create_WithMissingRequiredField_Should_Throw(
            string? userId, string? endpoint, string? p256dhKey, string? authKey)
        {
            Assert.Throws<ArgumentException>(() =>
                WebPushSubscription.Create(userId!, endpoint!, p256dhKey!, authKey!));
        }
    }
}
