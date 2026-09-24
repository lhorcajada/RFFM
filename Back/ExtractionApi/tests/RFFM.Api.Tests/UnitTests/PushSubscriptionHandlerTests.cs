#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
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
    public class PushSubscriptionHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public PushSubscriptionHandlerTests(PostgresContainerFixture fixture)
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
        public async Task GetVapidPublicKey_ReturnsConfiguredKey()
        {
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { ["WebPush:PublicKey"] = "test-public-key" })
                .Build();
            var handler = new GetVapidPublicKey.Handler(configuration);

            var result = await handler.Handle(new GetVapidPublicKey.VapidPublicKeyQuery(), CancellationToken.None);

            Assert.Equal("test-public-key", result.PublicKey);
        }

        [Fact]
        public async Task SubscribeWebPush_CreatesNewSubscription()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var endpoint = $"https://fcm.googleapis.com/fcm/send/{Guid.NewGuid():N}";
            var handler = new SubscribeWebPush.Handler(db, MockCurrentUser(userId).Object);

            await handler.Handle(new SubscribeWebPush.SubscribeWebPushCommand(endpoint, "p256dh", "auth"), CancellationToken.None);

            var subscription = await db.WebPushSubscriptions.SingleAsync(s => s.Endpoint == endpoint);
            Assert.Equal(userId, subscription.UserId);
        }

        [Fact]
        public async Task SubscribeWebPush_ResubscribingSameEndpoint_UpdatesInsteadOfDuplicating()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var endpoint = $"https://fcm.googleapis.com/fcm/send/{Guid.NewGuid():N}";
            var handler = new SubscribeWebPush.Handler(db, MockCurrentUser(userId).Object);

            await handler.Handle(new SubscribeWebPush.SubscribeWebPushCommand(endpoint, "p256dh-old", "auth-old"), CancellationToken.None);
            await handler.Handle(new SubscribeWebPush.SubscribeWebPushCommand(endpoint, "p256dh-new", "auth-new"), CancellationToken.None);

            var subscriptions = await db.WebPushSubscriptions.Where(s => s.Endpoint == endpoint).ToListAsync();
            Assert.Single(subscriptions);
            Assert.Equal("p256dh-new", subscriptions[0].P256dhKey);
        }

        [Fact]
        public async Task UnsubscribeWebPush_OwnSubscription_DeletesIt()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var endpoint = $"https://fcm.googleapis.com/fcm/send/{Guid.NewGuid():N}";
            db.WebPushSubscriptions.Add(WebPushSubscription.Create(userId, endpoint, "p256dh", "auth"));
            await db.SaveChangesAsync();

            var handler = new UnsubscribeWebPush.Handler(db, MockCurrentUser(userId).Object);
            await handler.Handle(new UnsubscribeWebPush.UnsubscribeWebPushCommand(endpoint), CancellationToken.None);

            var exists = await db.WebPushSubscriptions.AnyAsync(s => s.Endpoint == endpoint);
            Assert.False(exists);
        }

        [Fact]
        public async Task UnsubscribeWebPush_AnotherUsersSubscription_DoesNotDeleteIt()
        {
            await using var db = _fixture.CreateDbContext();
            var ownerId = Guid.NewGuid().ToString();
            var attackerId = Guid.NewGuid().ToString();
            var endpoint = $"https://fcm.googleapis.com/fcm/send/{Guid.NewGuid():N}";
            db.WebPushSubscriptions.Add(WebPushSubscription.Create(ownerId, endpoint, "p256dh", "auth"));
            await db.SaveChangesAsync();

            var handler = new UnsubscribeWebPush.Handler(db, MockCurrentUser(attackerId).Object);
            await handler.Handle(new UnsubscribeWebPush.UnsubscribeWebPushCommand(endpoint), CancellationToken.None);

            var exists = await db.WebPushSubscriptions.AnyAsync(s => s.Endpoint == endpoint);
            Assert.True(exists);
        }
    }
}
