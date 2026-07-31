#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.PushNotifications;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Features.Mobile.PushNotifications;
using RFFM.Api.Features.Mobile.PushNotifications.Services;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class PushNotificationDispatcherTests
    {
        private readonly PostgresContainerFixture _fixture;

        public PushNotificationDispatcherTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(Club Club, Team Team)> SeedClubAndTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"Push Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}",
                DateTime.UtcNow,
                DateTime.UtcNow.AddMonths(9),
                isActive: true,
                club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new RFFM.Api.Domain.Models.TeamModelBase
            {
                Name = "Push Test Team",
                CategoryId = RFFM.Api.Domain.Entities.Competitions.Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return (club, team);
        }

        /// <summary>
        /// DispatchNewsPublishedAsync queries every PushToken row with no per-test scoping
        /// (it targets the whole audience by design), so tests asserting an exact message count
        /// or "not called" must first clear leftover rows from other tests sharing this
        /// PostgresContainerFixture-backed database (see PostgresCollection — tests in this
        /// collection run sequentially, so this is safe).
        /// </summary>
        private static async Task ClearAllPushTokensAsync(AppDbContext db)
        {
            var existing = await db.PushTokens.ToListAsync();
            if (existing.Count > 0)
            {
                db.PushTokens.RemoveRange(existing);
                await db.SaveChangesAsync();
            }
        }

        private static PushToken AddToken(AppDbContext db, string userId, bool newsEnabled = true, bool calendarEnabled = true)
        {
            var token = PushToken.Create(userId, $"device-{Guid.NewGuid():N}", $"ExponentPushToken[{Guid.NewGuid():N}]", "ios");
            if (!newsEnabled || !calendarEnabled)
                token.UpdatePreferences(newsEnabled, calendarEnabled);
            db.PushTokens.Add(token);
            return token;
        }

        [Fact]
        public async Task DispatchNewsPublishedAsync_SendsOnlyToTokensWithNewsEnabled()
        {
            await using var db = _fixture.CreateDbContext();
            await ClearAllPushTokensAsync(db);
            var enabledUser = Guid.NewGuid().ToString();
            var disabledUser = Guid.NewGuid().ToString();
            var enabledToken = AddToken(db, enabledUser, newsEnabled: true);
            AddToken(db, disabledUser, newsEnabled: false);
            await db.SaveChangesAsync();

            var expoMock = new Mock<IExpoPushService>();
            expoMock.Setup(s => s.SendAsync(It.IsAny<IReadOnlyCollection<ExpoPushMessage>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Array.Empty<string>());

            var dispatcher = new PushNotificationDispatcher(db, expoMock.Object);

            await dispatcher.DispatchNewsPublishedAsync("news-1", CancellationToken.None);

            expoMock.Verify(s => s.SendAsync(
                It.Is<IReadOnlyCollection<ExpoPushMessage>>(msgs =>
                    msgs.Count == 1 &&
                    msgs.Single().To == enabledToken.ExpoPushToken &&
                    (string)msgs.Single().Data["type"] == "news" &&
                    (string)msgs.Single().Data["id"] == "news-1"),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task DispatchNewsPublishedAsync_PrunesTokensReportedAsDeviceNotRegistered()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var deadToken = AddToken(db, userId);
            await db.SaveChangesAsync();

            var expoMock = new Mock<IExpoPushService>();
            expoMock.Setup(s => s.SendAsync(It.IsAny<IReadOnlyCollection<ExpoPushMessage>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new[] { deadToken.ExpoPushToken });

            var dispatcher = new PushNotificationDispatcher(db, expoMock.Object);

            await dispatcher.DispatchNewsPublishedAsync("news-1", CancellationToken.None);

            var remaining = await db.PushTokens.AsNoTracking().AnyAsync(p => p.Id == deadToken.Id);
            Assert.False(remaining);
        }

        [Fact]
        public async Task DispatchNewsPublishedAsync_WhenExpoServiceThrows_DoesNotThrow()
        {
            await using var db = _fixture.CreateDbContext();
            AddToken(db, Guid.NewGuid().ToString());
            await db.SaveChangesAsync();

            var expoMock = new Mock<IExpoPushService>();
            expoMock.Setup(s => s.SendAsync(It.IsAny<IReadOnlyCollection<ExpoPushMessage>>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("boom"));

            var dispatcher = new PushNotificationDispatcher(db, expoMock.Object);

            var exception = await Record.ExceptionAsync(() => dispatcher.DispatchNewsPublishedAsync("news-1", CancellationToken.None));

            Assert.Null(exception);
        }

        [Fact]
        public async Task DispatchNewsPublishedAsync_NoTokens_DoesNotCallExpoService()
        {
            await using var db = _fixture.CreateDbContext();
            await ClearAllPushTokensAsync(db);
            var expoMock = new Mock<IExpoPushService>();
            var dispatcher = new PushNotificationDispatcher(db, expoMock.Object);

            await dispatcher.DispatchNewsPublishedAsync("news-none", CancellationToken.None);

            expoMock.Verify(s => s.SendAsync(It.IsAny<IReadOnlyCollection<ExpoPushMessage>>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task DispatchCalendarChangedAsync_SendsToUserLinkedDirectlyViaUserTeam()
        {
            await using var db = _fixture.CreateDbContext();
            var (_, team) = await SeedClubAndTeamAsync(db);
            var userId = Guid.NewGuid().ToString();
            var token = AddToken(db, userId, calendarEnabled: true);
            db.Set<UserTeam>().Add(new UserTeam(userId, team.Id, Membership.Player.Id));
            await db.SaveChangesAsync();

            var expoMock = new Mock<IExpoPushService>();
            expoMock.Setup(s => s.SendAsync(It.IsAny<IReadOnlyCollection<ExpoPushMessage>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Array.Empty<string>());

            var dispatcher = new PushNotificationDispatcher(db, expoMock.Object);
            await dispatcher.DispatchCalendarChangedAsync("event-1", team.Id, CancellationToken.None);

            expoMock.Verify(s => s.SendAsync(
                It.Is<IReadOnlyCollection<ExpoPushMessage>>(msgs =>
                    msgs.Count == 1 &&
                    msgs.Single().To == token.ExpoPushToken &&
                    (string)msgs.Single().Data["type"] == "calendar" &&
                    (string)msgs.Single().Data["id"] == "event-1" &&
                    (string)msgs.Single().Data["teamId"] == team.Id),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task DispatchCalendarChangedAsync_SendsToUserLinkedViaUserClub()
        {
            await using var db = _fixture.CreateDbContext();
            var (club, team) = await SeedClubAndTeamAsync(db);
            var userId = Guid.NewGuid().ToString();
            var token = AddToken(db, userId, calendarEnabled: true);
            db.Set<UserClub>().Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var expoMock = new Mock<IExpoPushService>();
            expoMock.Setup(s => s.SendAsync(It.IsAny<IReadOnlyCollection<ExpoPushMessage>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Array.Empty<string>());

            var dispatcher = new PushNotificationDispatcher(db, expoMock.Object);
            await dispatcher.DispatchCalendarChangedAsync("event-2", team.Id, CancellationToken.None);

            expoMock.Verify(s => s.SendAsync(
                It.Is<IReadOnlyCollection<ExpoPushMessage>>(msgs => msgs.Count == 1 && msgs.Single().To == token.ExpoPushToken),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task DispatchCalendarChangedAsync_SkipsTokensWithCalendarDisabled()
        {
            await using var db = _fixture.CreateDbContext();
            var (_, team) = await SeedClubAndTeamAsync(db);
            var userId = Guid.NewGuid().ToString();
            AddToken(db, userId, calendarEnabled: false);
            db.Set<UserTeam>().Add(new UserTeam(userId, team.Id, Membership.Player.Id));
            await db.SaveChangesAsync();

            var expoMock = new Mock<IExpoPushService>();
            var dispatcher = new PushNotificationDispatcher(db, expoMock.Object);

            await dispatcher.DispatchCalendarChangedAsync("event-3", team.Id, CancellationToken.None);

            expoMock.Verify(s => s.SendAsync(It.IsAny<IReadOnlyCollection<ExpoPushMessage>>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task DispatchCalendarChangedAsync_PrunesTokensReportedAsDeviceNotRegistered()
        {
            await using var db = _fixture.CreateDbContext();
            var (_, team) = await SeedClubAndTeamAsync(db);
            var userId = Guid.NewGuid().ToString();
            var deadToken = AddToken(db, userId, calendarEnabled: true);
            db.Set<UserTeam>().Add(new UserTeam(userId, team.Id, Membership.Player.Id));
            await db.SaveChangesAsync();

            var expoMock = new Mock<IExpoPushService>();
            expoMock.Setup(s => s.SendAsync(It.IsAny<IReadOnlyCollection<ExpoPushMessage>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new[] { deadToken.ExpoPushToken });

            var dispatcher = new PushNotificationDispatcher(db, expoMock.Object);
            await dispatcher.DispatchCalendarChangedAsync("event-4", team.Id, CancellationToken.None);

            var remaining = await db.PushTokens.AsNoTracking().AnyAsync(p => p.Id == deadToken.Id);
            Assert.False(remaining);
        }

        [Fact]
        public async Task DispatchCalendarChangedAsync_WhenExpoServiceThrows_DoesNotThrow()
        {
            await using var db = _fixture.CreateDbContext();
            var (_, team) = await SeedClubAndTeamAsync(db);
            var userId = Guid.NewGuid().ToString();
            AddToken(db, userId, calendarEnabled: true);
            db.Set<UserTeam>().Add(new UserTeam(userId, team.Id, Membership.Player.Id));
            await db.SaveChangesAsync();

            var expoMock = new Mock<IExpoPushService>();
            expoMock.Setup(s => s.SendAsync(It.IsAny<IReadOnlyCollection<ExpoPushMessage>>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("boom"));

            var dispatcher = new PushNotificationDispatcher(db, expoMock.Object);

            var exception = await Record.ExceptionAsync(() => dispatcher.DispatchCalendarChangedAsync("event-5", team.Id, CancellationToken.None));

            Assert.Null(exception);
        }
    }
}
