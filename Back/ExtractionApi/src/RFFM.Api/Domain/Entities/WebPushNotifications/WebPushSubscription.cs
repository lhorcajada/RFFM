namespace RFFM.Api.Domain.Entities.WebPushNotifications
{
    public class WebPushSubscription : BaseEntity
    {
        public string UserId { get; private set; } = null!;
        public string Endpoint { get; private set; } = null!;
        public string P256dhKey { get; private set; } = null!;
        public string AuthKey { get; private set; } = null!;
        public DateTime CreatedAt { get; private set; }

        private WebPushSubscription() { }

        public static WebPushSubscription Create(string userId, string endpoint, string p256dhKey, string authKey)
        {
            if (string.IsNullOrWhiteSpace(userId))
                throw new ArgumentException("El usuario es obligatorio.");
            if (string.IsNullOrWhiteSpace(endpoint))
                throw new ArgumentException("El endpoint es obligatorio.");
            if (string.IsNullOrWhiteSpace(p256dhKey))
                throw new ArgumentException("La clave p256dh es obligatoria.");
            if (string.IsNullOrWhiteSpace(authKey))
                throw new ArgumentException("La clave de autenticación es obligatoria.");

            return new WebPushSubscription
            {
                UserId = userId,
                Endpoint = endpoint,
                P256dhKey = p256dhKey,
                AuthKey = authKey,
                CreatedAt = DateTime.UtcNow
            };
        }
    }
}
