namespace RFFM.Api.Domain.Entities.PushNotifications
{
    public class PushToken : BaseEntity
    {
        public string UserId { get; private set; } = null!;
        public string DeviceId { get; private set; } = null!;
        public string ExpoPushToken { get; private set; } = null!;
        public string Platform { get; private set; } = null!;
        public bool NewsEnabled { get; private set; }
        public bool CalendarEnabled { get; private set; }
        public DateTime CreatedAt { get; private set; }
        public DateTime UpdatedAt { get; private set; }

        private PushToken() { }

        public static PushToken Create(string userId, string deviceId, string expoPushToken, string platform)
        {
            if (string.IsNullOrWhiteSpace(userId))
                throw new ArgumentException("El usuario es obligatorio.");
            if (string.IsNullOrWhiteSpace(deviceId))
                throw new ArgumentException("El identificador de dispositivo es obligatorio.");
            if (string.IsNullOrWhiteSpace(expoPushToken))
                throw new ArgumentException("El token de push es obligatorio.");
            if (string.IsNullOrWhiteSpace(platform))
                throw new ArgumentException("La plataforma es obligatoria.");

            var now = DateTime.UtcNow;
            return new PushToken
            {
                UserId = userId,
                DeviceId = deviceId,
                ExpoPushToken = expoPushToken,
                Platform = platform,
                NewsEnabled = true,
                CalendarEnabled = true,
                CreatedAt = now,
                UpdatedAt = now
            };
        }

        public void UpdateToken(string expoPushToken)
        {
            if (string.IsNullOrWhiteSpace(expoPushToken))
                throw new ArgumentException("El token de push es obligatorio.");

            ExpoPushToken = expoPushToken;
            UpdatedAt = DateTime.UtcNow;
        }

        public void UpdatePreferences(bool newsEnabled, bool calendarEnabled)
        {
            NewsEnabled = newsEnabled;
            CalendarEnabled = calendarEnabled;
            UpdatedAt = DateTime.UtcNow;
        }
    }
}
