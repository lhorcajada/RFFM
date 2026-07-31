#nullable enable
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain.Entities.PushNotifications;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Mobile.PushNotifications;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class UnregisterPushTokenHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UnregisterPushTokenHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private Mock<ICurrentUserService> MockCurrentUser(string userId)
        {
            var mock = new Mock<ICurrentUserService>();
            mock.Setup(u => u.UserId).Returns(userId);
            mock.Setup(u => u.IsAuthenticated).Returns(true);
            return mock;
        }

        [Fact]
        public async Task Handle_ExistingToken_DeletesIt()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var deviceId = $"device-{Guid.NewGuid():N}";
            var token = PushToken.Create(userId, deviceId, "ExponentPushToken[a]", "ios");
            seedDb.PushTokens.Add(token);
            await seedDb.SaveChangesAsync();

            await using var db = _fixture.CreateDbContext();
            var handler = new UnregisterPushToken.Handler(db, MockCurrentUser(userId).Object);

            await handler.Handle(new UnregisterPushToken.UnregisterPushTokenCommand { DeviceId = deviceId }, CancellationToken.None);

            var exists = await db.PushTokens.AsNoTracking().AnyAsync(p => p.UserId == userId && p.DeviceId == deviceId);
            Assert.False(exists);
        }

        [Fact]
        public async Task Handle_NonExistentToken_DoesNotThrow()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var handler = new UnregisterPushToken.Handler(db, MockCurrentUser(userId).Object);

            var exception = await Record.ExceptionAsync(() =>
                handler.Handle(new UnregisterPushToken.UnregisterPushTokenCommand { DeviceId = "never-registered" }, CancellationToken.None).AsTask());

            Assert.Null(exception);
        }

        [Fact]
        public async Task Handle_DoesNotDeleteAnotherUsersTokenWithSameDeviceId()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var deviceId = $"device-{Guid.NewGuid():N}";
            var ownerUserId = Guid.NewGuid().ToString();
            var otherUserId = Guid.NewGuid().ToString();
            seedDb.PushTokens.Add(PushToken.Create(ownerUserId, deviceId, "ExponentPushToken[owner]", "ios"));
            await seedDb.SaveChangesAsync();

            await using var db = _fixture.CreateDbContext();
            var handler = new UnregisterPushToken.Handler(db, MockCurrentUser(otherUserId).Object);

            await handler.Handle(new UnregisterPushToken.UnregisterPushTokenCommand { DeviceId = deviceId }, CancellationToken.None);

            var stillExists = await db.PushTokens.AsNoTracking().AnyAsync(p => p.UserId == ownerUserId && p.DeviceId == deviceId);
            Assert.True(stillExists);
        }
    }
}
