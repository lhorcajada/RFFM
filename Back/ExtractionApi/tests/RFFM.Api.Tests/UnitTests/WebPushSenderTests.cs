using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using RFFM.Api.Domain.Entities.WebPushNotifications;
using RFFM.Api.Features.Coaches.Notifications.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class WebPushSenderTests
    {
        [Fact]
        public async Task SendAsync_WithMissingConfiguration_Should_Throw()
        {
            var configuration = new ConfigurationBuilder().Build();
            var sender = new WebPushSender(configuration);
            var subscription = WebPushSubscription.Create("user-1", "https://example.com/push/1", "p256dh", "auth");

            await Assert.ThrowsAsync<InvalidOperationException>(
                () => sender.SendAsync(subscription, "{}"));
        }
    }
}
