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

        [Fact]
        public async Task DeleteNotifications_RemovesOnlyRequestedOwnNotifications()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var first = Notification.Create(userId, "NewsPublished", "First", "Body", null);
            var second = Notification.Create(userId, "NewsPublished", "Second", "Body", null);
            var kept = Notification.Create(userId, "NewsPublished", "Kept", "Body", null);
            db.Notifications.AddRange(first, second, kept);
            await db.SaveChangesAsync();

            var handler = new DeleteNotifications.Handler(db, MockCurrentUser(userId).Object);
            var deleted = await handler.Handle(
                new DeleteNotifications.DeleteNotificationsCommand([first.Id, second.Id]), CancellationToken.None);

            Assert.Equal(2, deleted);
            var remaining = await db.Notifications.AsNoTracking()
                .Where(n => n.Id == first.Id || n.Id == second.Id || n.Id == kept.Id)
                .Select(n => n.Id)
                .ToListAsync();
            Assert.Equal([kept.Id], remaining);
        }

        [Fact]
        public async Task DeleteNotifications_AnotherUsersNotification_IsNotDeleted()
        {
            await using var db = _fixture.CreateDbContext();
            var ownerId = Guid.NewGuid().ToString();
            var attackerId = Guid.NewGuid().ToString();
            var notification = Notification.Create(ownerId, "NewsPublished", "T", "B", null);
            db.Notifications.Add(notification);
            await db.SaveChangesAsync();

            var handler = new DeleteNotifications.Handler(db, MockCurrentUser(attackerId).Object);
            var deleted = await handler.Handle(
                new DeleteNotifications.DeleteNotificationsCommand([notification.Id]), CancellationToken.None);

            Assert.Equal(0, deleted);
            Assert.True(await db.Notifications.AsNoTracking().AnyAsync(n => n.Id == notification.Id));
        }

        [Fact]
        public async Task DeleteAllNotifications_WithCoachApp_DeletesOnlyOwnCoachNotifications()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var otherUserId = Guid.NewGuid().ToString();
            var coachRead = Notification.Create(userId, "NewsPublished", "Coach1", "Body", "/coach/news/1");
            coachRead.MarkAsRead();
            var coachUnread = Notification.Create(userId, "NewsPublished", "Coach2", "Body", null);
            var federation = Notification.Create(userId, "SquadHistoryReady", "Federation", "Body", "/federation/squad-history/555?seasonId=22");
            var otherUsers = Notification.Create(otherUserId, "NewsPublished", "Other", "Body", "/coach/news/1");
            db.Notifications.AddRange(coachRead, coachUnread, federation, otherUsers);
            await db.SaveChangesAsync();

            var handler = new DeleteAllNotifications.Handler(db, MockCurrentUser(userId).Object);
            var deleted = await handler.Handle(
                new DeleteAllNotifications.DeleteAllNotificationsCommand(NotificationApps.Coach), CancellationToken.None);

            Assert.Equal(2, deleted);
            var remaining = await db.Notifications.AsNoTracking()
                .Where(n => n.Id == coachRead.Id || n.Id == coachUnread.Id || n.Id == federation.Id || n.Id == otherUsers.Id)
                .Select(n => n.Id)
                .ToListAsync();
            Assert.Equal(2, remaining.Count);
            Assert.Contains(federation.Id, remaining);
            Assert.Contains(otherUsers.Id, remaining);
        }

        [Fact]
        public async Task DeleteAllNotifications_WithFederationApp_DeletesOnlyFederationNotifications()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var coach = Notification.Create(userId, "NewsPublished", "Coach", "Body", "/coach/news/1");
            var federation = Notification.Create(userId, "SquadHistoryReady", "Federation", "Body", "/federation/squad-history/555?seasonId=22");
            db.Notifications.AddRange(coach, federation);
            await db.SaveChangesAsync();

            var handler = new DeleteAllNotifications.Handler(db, MockCurrentUser(userId).Object);
            await handler.Handle(
                new DeleteAllNotifications.DeleteAllNotificationsCommand(NotificationApps.Federation), CancellationToken.None);

            var remaining = await db.Notifications.AsNoTracking()
                .Where(n => n.Id == coach.Id || n.Id == federation.Id)
                .Select(n => n.Id)
                .ToListAsync();
            Assert.Equal([coach.Id], remaining);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("unknown")]
        public void DeleteAllNotificationsValidator_WithoutValidApp_IsInvalid(string? app)
        {
            var result = new DeleteAllNotifications.Validator()
                .Validate(new DeleteAllNotifications.DeleteAllNotificationsCommand(app));

            Assert.False(result.IsValid);
        }

        [Fact]
        public void DeleteNotificationsValidator_EmptyIds_IsInvalid()
        {
            var result = new DeleteNotifications.Validator()
                .Validate(new DeleteNotifications.DeleteNotificationsCommand([]));

            Assert.False(result.IsValid);
        }

        [Fact]
        public void DeleteNotificationsValidator_TooManyIds_IsInvalid()
        {
            var ids = Enumerable.Range(0, DeleteNotifications.MaxIdsPerRequest + 1)
                .Select(_ => Guid.NewGuid().ToString())
                .ToArray();

            var result = new DeleteNotifications.Validator()
                .Validate(new DeleteNotifications.DeleteNotificationsCommand(ids));

            Assert.False(result.IsValid);
        }
    }
}
