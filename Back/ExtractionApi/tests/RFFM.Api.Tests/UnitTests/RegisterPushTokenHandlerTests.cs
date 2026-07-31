#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Mobile.PushNotifications;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class RegisterPushTokenHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public RegisterPushTokenHandlerTests(PostgresContainerFixture fixture)
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
        public async Task Handle_NewDevice_CreatesPushToken()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var deviceId = $"device-{Guid.NewGuid():N}";

            var handler = new RegisterPushToken.Handler(db, MockCurrentUser(userId).Object);
            var command = new RegisterPushToken.RegisterPushTokenCommand
            {
                DeviceId = deviceId,
                ExpoPushToken = "ExponentPushToken[abc]",
                Platform = "ios"
            };

            await handler.Handle(command, CancellationToken.None);

            var created = await db.PushTokens.AsNoTracking().SingleAsync(p => p.UserId == userId && p.DeviceId == deviceId);
            Assert.Equal("ExponentPushToken[abc]", created.ExpoPushToken);
            Assert.Equal("ios", created.Platform);
            Assert.True(created.NewsEnabled);
            Assert.True(created.CalendarEnabled);
        }

        [Fact]
        public async Task Handle_ExistingDevice_UpdatesToken()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var deviceId = $"device-{Guid.NewGuid():N}";

            var firstHandler = new RegisterPushToken.Handler(db, MockCurrentUser(userId).Object);
            await firstHandler.Handle(new RegisterPushToken.RegisterPushTokenCommand
            {
                DeviceId = deviceId,
                ExpoPushToken = "ExponentPushToken[old]",
                Platform = "ios"
            }, CancellationToken.None);

            await using var db2 = _fixture.CreateDbContext();
            var secondHandler = new RegisterPushToken.Handler(db2, MockCurrentUser(userId).Object);
            await secondHandler.Handle(new RegisterPushToken.RegisterPushTokenCommand
            {
                DeviceId = deviceId,
                ExpoPushToken = "ExponentPushToken[new]",
                Platform = "ios"
            }, CancellationToken.None);

            var rows = await db2.PushTokens.AsNoTracking().Where(p => p.UserId == userId && p.DeviceId == deviceId).ToListAsync();
            Assert.Single(rows);
            Assert.Equal("ExponentPushToken[new]", rows[0].ExpoPushToken);
        }

        [Fact]
        public async Task Handle_TwoDevicesForSameUser_CreatesTwoRows()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var handler = new RegisterPushToken.Handler(db, MockCurrentUser(userId).Object);

            await handler.Handle(new RegisterPushToken.RegisterPushTokenCommand
            {
                DeviceId = $"device-a-{Guid.NewGuid():N}",
                ExpoPushToken = "ExponentPushToken[a]",
                Platform = "ios"
            }, CancellationToken.None);

            await handler.Handle(new RegisterPushToken.RegisterPushTokenCommand
            {
                DeviceId = $"device-b-{Guid.NewGuid():N}",
                ExpoPushToken = "ExponentPushToken[b]",
                Platform = "android"
            }, CancellationToken.None);

            var count = await db.PushTokens.AsNoTracking().CountAsync(p => p.UserId == userId);
            Assert.Equal(2, count);
        }

        [Fact]
        public async Task Validator_RequiresDeviceId()
        {
            var validator = new RegisterPushToken.Validator();
            var result = await validator.ValidateAsync(new RegisterPushToken.RegisterPushTokenCommand
            {
                DeviceId = "",
                ExpoPushToken = "ExponentPushToken[a]",
                Platform = "ios"
            });
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == "DeviceId");
        }

        [Fact]
        public async Task Validator_RequiresExpoPushToken()
        {
            var validator = new RegisterPushToken.Validator();
            var result = await validator.ValidateAsync(new RegisterPushToken.RegisterPushTokenCommand
            {
                DeviceId = "device-1",
                ExpoPushToken = "",
                Platform = "ios"
            });
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == "ExpoPushToken");
        }

        [Fact]
        public async Task Validator_RequiresPlatform()
        {
            var validator = new RegisterPushToken.Validator();
            var result = await validator.ValidateAsync(new RegisterPushToken.RegisterPushTokenCommand
            {
                DeviceId = "device-1",
                ExpoPushToken = "ExponentPushToken[a]",
                Platform = ""
            });
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == "Platform");
        }

        [Fact]
        public async Task Validator_ValidCommand_Passes()
        {
            var validator = new RegisterPushToken.Validator();
            var result = await validator.ValidateAsync(new RegisterPushToken.RegisterPushTokenCommand
            {
                DeviceId = "device-1",
                ExpoPushToken = "ExponentPushToken[a]",
                Platform = "ios"
            });
            Assert.True(result.IsValid);
        }
    }
}
