#nullable enable
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.PushNotifications;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Mobile.PushNotifications;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class UpdatePushPreferencesHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UpdatePushPreferencesHandlerTests(PostgresContainerFixture fixture)
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
        public async Task Handle_ExistingToken_UpdatesPreferences()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var deviceId = $"device-{Guid.NewGuid():N}";
            seedDb.PushTokens.Add(PushToken.Create(userId, deviceId, "ExponentPushToken[a]", "ios"));
            await seedDb.SaveChangesAsync();

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdatePushPreferences.Handler(db, MockCurrentUser(userId).Object);

            await handler.Handle(new UpdatePushPreferences.UpdatePushPreferencesCommand
            {
                DeviceId = deviceId,
                NewsEnabled = false,
                CalendarEnabled = true
            }, CancellationToken.None);

            var updated = await db.PushTokens.AsNoTracking().SingleAsync(p => p.UserId == userId && p.DeviceId == deviceId);
            Assert.False(updated.NewsEnabled);
            Assert.True(updated.CalendarEnabled);
        }

        [Fact]
        public async Task Handle_DeviceNotRegistered_ThrowsNotFoundException()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var handler = new UpdatePushPreferences.Handler(db, MockCurrentUser(userId).Object);

            var exception = await Assert.ThrowsAsync<NotFoundException>(() =>
                handler.Handle(new UpdatePushPreferences.UpdatePushPreferencesCommand
                {
                    DeviceId = "never-registered",
                    NewsEnabled = false,
                    CalendarEnabled = false
                }, CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.PushTokenNotFound, exception.Code);
        }

        [Fact]
        public async Task Handle_AnotherUsersDeviceId_ThrowsNotFoundException()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var deviceId = $"device-{Guid.NewGuid():N}";
            var ownerUserId = Guid.NewGuid().ToString();
            var otherUserId = Guid.NewGuid().ToString();
            seedDb.PushTokens.Add(PushToken.Create(ownerUserId, deviceId, "ExponentPushToken[owner]", "ios"));
            await seedDb.SaveChangesAsync();

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdatePushPreferences.Handler(db, MockCurrentUser(otherUserId).Object);

            await Assert.ThrowsAsync<NotFoundException>(() =>
                handler.Handle(new UpdatePushPreferences.UpdatePushPreferencesCommand
                {
                    DeviceId = deviceId,
                    NewsEnabled = false,
                    CalendarEnabled = false
                }, CancellationToken.None).AsTask());
        }
    }
}
