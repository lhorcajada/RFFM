namespace RFFM.Api.Domain.Entities.WebPushNotifications
{
    public class Notification : BaseEntity
    {
        public string UserId { get; private set; } = null!;
        public string Type { get; private set; } = null!;
        public string Title { get; private set; } = null!;
        public string Body { get; private set; } = null!;
        public string? DeepLinkPath { get; private set; }
        public bool IsRead { get; private set; }
        public DateTime CreatedAt { get; private set; }

        private Notification() { }

        public static Notification Create(string userId, string type, string title, string body, string? deepLinkPath)
        {
            if (string.IsNullOrWhiteSpace(userId))
                throw new ArgumentException("El usuario es obligatorio.");
            if (string.IsNullOrWhiteSpace(type))
                throw new ArgumentException("El tipo es obligatorio.");
            if (string.IsNullOrWhiteSpace(title))
                throw new ArgumentException("El título es obligatorio.");
            if (string.IsNullOrWhiteSpace(body))
                throw new ArgumentException("El cuerpo es obligatorio.");

            return new Notification
            {
                UserId = userId,
                Type = type,
                Title = title,
                Body = body,
                DeepLinkPath = deepLinkPath,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            };
        }

        public void MarkAsRead() => IsRead = true;
    }
}
