namespace RFFM.Api.Domain.Entities.Federation.MatchResultNotifications
{
    /// <summary>Baja de las notificaciones de resultados: por defecto están activadas y solo se guarda la baja.</summary>
    public class MatchResultNotificationOptOut : BaseEntity
    {
        public string UserId { get; private set; } = null!;
        public DateTime CreatedAt { get; private set; }

        private MatchResultNotificationOptOut() { }

        public static MatchResultNotificationOptOut Create(string userId, DateTime now)
        {
            if (string.IsNullOrWhiteSpace(userId))
                throw new ArgumentException("El usuario es obligatorio.");

            return new MatchResultNotificationOptOut { UserId = userId, CreatedAt = now };
        }
    }
}
