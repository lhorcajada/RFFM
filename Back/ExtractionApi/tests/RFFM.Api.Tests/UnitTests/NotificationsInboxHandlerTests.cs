#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain.Entities.WebPushNotifications;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.Notifications;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class NotificationsInboxHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public NotificationsInboxHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static Mock<ICurrentUserService> MockCurrentUser(string userId)
        {
            var mock = new Mock<ICurrentUserService>();
            mock.Setup(u => u.UserId).Returns(userId);
            mock.Setup(u => u.IsAuthenticated).Returns(true);
            return mock;
        }

        [Fact]
        public async Task SearchNotifications_ReturnsOnlyOwnNotifications_NewestFirst()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var otherUserId = Guid.NewGuid().ToString();

            var older = Notification.Create(userId, "NewsPublished", "Older", "Body", null);
            var newer = Notification.Create(userId, "NewsPublished", "Newer", "Body", null);
            var otherUsers = Notification.Create(otherUserId, "NewsPublished", "Other", "Body", null);
            db.Notifications.AddRange(older, newer, otherUsers);
            await db.SaveChangesAsync();

            var handler = new SearchNotifications.Handler(db, MockCurrentUser(userId).Object);
            var (items, total) = await handler.Handle(new SearchNotifications.SearchNotificationsQuery(1, 25), CancellationToken.None);

            Assert.Equal(2, total);
            Assert.Equal(2, items.Length);
            Assert.All(items, i => Assert.NotEqual(otherUsers.Id, i.Id));
            Assert.True(items[0].CreatedAt >= items[1].CreatedAt);
        }

        [Fact]
        public async Task SearchNotifications_RespectsPageSize()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            for (var i = 0; i < 5; i++)
                db.Notifications.Add(Notification.Create(userId, "NewsPublished", $"N{i}", "Body", null));
            await db.SaveChangesAsync();

            var handler = new SearchNotifications.Handler(db, MockCurrentUser(userId).Object);
            var (items, total) = await handler.Handle(new SearchNotifications.SearchNotificationsQuery(1, 2), CancellationToken.None);

            Assert.Equal(5, total);
            Assert.Equal(2, items.Length);
        }

        [Fact]
        public async Task SearchNotifications_WithCoachApp_ExcludesFederationNotifications()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var coach = Notification.Create(userId, "NewsPublished", "Coach", "Body", "/coach/news/1");
            var withoutLink = Notification.Create(userId, "NewsPublished", "NoLink", "Body", null);
            var federation = Notification.Create(userId, "SquadHistoryReady", "Federation", "Body", "/federation/squad-history/555?seasonId=22");
            db.Notifications.AddRange(coach, withoutLink, federation);
            await db.SaveChangesAsync();

            var handler = new SearchNotifications.Handler(db, MockCurrentUser(userId).Object);
            var (items, total) = await handler.Handle(
                new SearchNotifications.SearchNotificationsQuery(1, 25, NotificationApps.Coach), CancellationToken.None);

            Assert.Equal(2, total);
            Assert.DoesNotContain(items, i => i.Id == federation.Id);
        }

        [Fact]
        public async Task SearchNotifications_WithFederationApp_ReturnsOnlyFederationNotifications()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            db.Notifications.Add(Notification.Create(userId, "NewsPublished", "Coach", "Body", "/coach/news/1"));
            var federation = Notification.Create(userId, "SquadHistoryReady", "Federation", "Body", "/federation/squad-history/555?seasonId=22");
            db.Notifications.Add(federation);
            await db.SaveChangesAsync();

            var handler = new SearchNotifications.Handler(db, MockCurrentUser(userId).Object);
            var (items, total) = await handler.Handle(
                new SearchNotifications.SearchNotificationsQuery(1, 25, NotificationApps.Federation), CancellationToken.None);

            Assert.Equal(1, total);
            Assert.Equal(federation.Id, items.Single().Id);
        }

        [Fact]
        public async Task MarkAllNotificationsRead_WithCoachApp_MarksOnlyOwnCoachNotifications()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var otherUserId = Guid.NewGuid().ToString();
            var coach = Notification.Create(userId, "NewsPublished", "Coach", "Body", "/coach/news/1");
            var federation = Notification.Create(userId, "SquadHistoryReady", "Federation", "Body", "/federation/squad-history/555?seasonId=22");
            var otherUsers = Notification.Create(otherUserId, "NewsPublished", "Other", "Body", "/coach/news/1");
            db.Notifications.AddRange(coach, federation, otherUsers);
            await db.SaveChangesAsync();

            var handler = new MarkAllNotificationsRead.Handler(db, MockCurrentUser(userId).Object);
            var marked = await handler.Handle(
                new MarkAllNotificationsRead.MarkAllNotificationsReadCommand(NotificationApps.Coach), CancellationToken.None);

            Assert.Equal(1, marked);
            var stored = await db.Notifications.AsNoTracking()
                .Where(n => n.Id == coach.Id || n.Id == federation.Id || n.Id == otherUsers.Id)
                .ToDictionaryAsync(n => n.Id, n => n.IsRead);
            Assert.True(stored[coach.Id]);
            Assert.False(stored[federation.Id]);
            Assert.False(stored[otherUsers.Id]);
        }

        [Fact]
        public async Task MarkAllNotificationsRead_WithFederationApp_MarksOnlyFederationNotifications()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var coach = Notification.Create(userId, "NewsPublished", "Coach", "Body", "/coach/news/1");
            var federation = Notification.Create(userId, "SquadHistoryReady", "Federation", "Body", "/federation/squad-history/555?seasonId=22");
            db.Notifications.AddRange(coach, federation);
            await db.SaveChangesAsync();

            var handler = new MarkAllNotificationsRead.Handler(db, MockCurrentUser(userId).Object);
            await handler.Handle(
                new MarkAllNotificationsRead.MarkAllNotificationsReadCommand(NotificationApps.Federation), CancellationToken.None);

            var stored = await db.Notifications.AsNoTracking()
                .Where(n => n.Id == coach.Id || n.Id == federation.Id)
                .ToDictionaryAsync(n => n.Id, n => n.IsRead);
            Assert.True(stored[federation.Id]);
            Assert.False(stored[coach.Id]);
        }

        [Fact]
        public async Task MarkNotificationRead_OwnNotification_SetsIsReadTrue()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var notification = Notification.Create(userId, "NewsPublished", "T", "B", null);
            db.Notifications.Add(notification);
            await db.SaveChangesAsync();

            var handler = new MarkNotificationRead.Handler(db, MockCurrentUser(userId).Object);
            await handler.Handle(new MarkNotificationRead.MarkNotificationReadCommand(notification.Id), CancellationToken.None);

            var updated = await db.Notifications.SingleAsync(n => n.Id == notification.Id);
            Assert.True(updated.IsRead);
        }

        [Fact]
        public async Task MarkNotificationRead_AnotherUsersNotification_ThrowsAndDoesNotModify()
        {
            await using var db = _fixture.CreateDbContext();
            var ownerId = Guid.NewGuid().ToString();
            var attackerId = Guid.NewGuid().ToString();
            var notification = Notification.Create(ownerId, "NewsPublished", "T", "B", null);
            db.Notifications.Add(notification);
            await db.SaveChangesAsync();

            var handler = new MarkNotificationRead.Handler(db, MockCurrentUser(attackerId).Object);

            await Assert.ThrowsAsync<RFFM.Api.Domain.NotFoundException>(
                () => handler.Handle(new MarkNotificationRead.MarkNotificationReadCommand(notification.Id), CancellationToken.None).AsTask());

            var unchanged = await db.Notifications.SingleAsync(n => n.Id == notification.Id);
            Assert.False(unchanged.IsRead);
        }
    }
}
