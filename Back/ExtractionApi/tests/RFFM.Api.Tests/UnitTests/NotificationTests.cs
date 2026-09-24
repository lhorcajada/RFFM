using System;
using RFFM.Api.Domain.Entities.WebPushNotifications;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class NotificationTests
    {
        [Fact]
        public void Create_WithValidData_Should_Be_Successful()
        {
            var notification = Notification.Create(
                userId: "user-1",
                type: "NewsPublished",
                title: "Nueva noticia",
                body: "Hay una nueva noticia disponible.",
                deepLinkPath: "/coach/news/123");

            Assert.Equal("user-1", notification.UserId);
            Assert.Equal("NewsPublished", notification.Type);
            Assert.Equal("Nueva noticia", notification.Title);
            Assert.Equal("Hay una nueva noticia disponible.", notification.Body);
            Assert.Equal("/coach/news/123", notification.DeepLinkPath);
            Assert.False(notification.IsRead);
            Assert.True(notification.CreatedAt <= DateTime.UtcNow);
        }

        [Fact]
        public void Create_WithoutDeepLinkPath_Should_Be_Successful()
        {
            var notification = Notification.Create(
                userId: "user-1",
                type: "ConvocationStatusChanged",
                title: "Convocatoria actualizada",
                body: "Un jugador ha respondido a la convocatoria.",
                deepLinkPath: null);

            Assert.Null(notification.DeepLinkPath);
        }

        [Fact]
        public void MarkAsRead_Should_Set_IsRead_To_True()
        {
            var notification = Notification.Create("user-1", "NewsPublished", "T", "B", null);

            notification.MarkAsRead();

            Assert.True(notification.IsRead);
        }
    }
}
