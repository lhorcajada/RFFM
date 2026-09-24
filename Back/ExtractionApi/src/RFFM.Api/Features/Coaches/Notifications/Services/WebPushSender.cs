using System.Net;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using RFFM.Api.Domain.Entities.WebPushNotifications;
using WebPush;

namespace RFFM.Api.Features.Coaches.Notifications.Services
{
    public class WebPushSender : IWebPushSender
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<WebPushSender>? _logger;

        public WebPushSender(IConfiguration configuration, ILogger<WebPushSender>? logger = null)
        {
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<WebPushSendResult> SendAsync(WebPushSubscription subscription, string payloadJson, CancellationToken ct = default)
        {
            var publicKey = _configuration["WebPush:PublicKey"];
            var privateKey = _configuration["WebPush:PrivateKey"];
            var subject = _configuration["WebPush:Subject"];

            if (string.IsNullOrWhiteSpace(publicKey) || string.IsNullOrWhiteSpace(privateKey) || string.IsNullOrWhiteSpace(subject))
                throw new InvalidOperationException("La configuración de Web Push no está definida (WebPush:PublicKey/PrivateKey/Subject).");

            var pushSubscription = new PushSubscription(subscription.Endpoint, subscription.P256dhKey, subscription.AuthKey);
            var vapidDetails = new VapidDetails(subject, publicKey, privateKey);
            var client = new WebPushClient();

            try
            {
                await client.SendNotificationAsync(pushSubscription, payloadJson, vapidDetails, cancellationToken: ct);
                return WebPushSendResult.Sent;
            }
            catch (WebPushException ex) when (ex.StatusCode is HttpStatusCode.Gone or HttpStatusCode.NotFound)
            {
                _logger?.LogInformation(ex, "Web push subscription {Endpoint} is gone", subscription.Endpoint);
                return WebPushSendResult.SubscriptionGone;
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Web push send failed for subscription {Endpoint}", subscription.Endpoint);
                return WebPushSendResult.Failed;
            }
        }
    }
}
