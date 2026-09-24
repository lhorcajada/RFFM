#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Entities.WebPushNotifications;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Notifications.Services;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class WebPushNotificationDispatcherTests
    {
        private readonly PostgresContainerFixture _fixture;

        public WebPushNotificationDispatcherTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(string TeamId, string TeamPlayerId)> SeedTeamAndPlayerAsync(AppDbContext db)
        {
            var club = Club.Create($"WebPush Test Club {Guid.NewGuid():N}", 1);
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

            var team = new Team(new TeamModelBase
            {
                Name = "WebPush Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test",
                LastName = "Player",
                Alias = $"webpush-testplayer-{Guid.NewGuid():N}",
                ClubId = club.Id
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = team.Id,
                SeasonId = season.Id,
                JoinedDate = DateTime.UtcNow,
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            return (team.Id, teamPlayer.Id);
        }

        [Fact]
        public async Task DispatchConvocationCreatedAsync_NotifiesLinkedPlayerAndApprovedFamilyMember()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);

            var playerUserId = Guid.NewGuid().ToString();
            var playerUserTeam = new UserTeam(playerUserId, teamId, Membership.Player.Id);
            db.Set<UserTeam>().Add(playerUserTeam);
            await db.SaveChangesAsync();
            playerUserTeam.LinkPlayer(teamPlayerId);

            var familyMember = TeamPlayerFamilyMember.Create(teamPlayerId, "Ana", "García", "600000000", "ana@test.com", null, "Mother");
            db.Set<TeamPlayerFamilyMember>().Add(familyMember);
            await db.SaveChangesAsync();
            var familyUserId = Guid.NewGuid().ToString();
            familyMember.LinkAccount(familyUserId);
            await db.SaveChangesAsync();

            var senderMock = new Mock<IWebPushSender>();
            var dispatcher = new WebPushNotificationDispatcher(db, senderMock.Object);

            await dispatcher.DispatchConvocationCreatedAsync(teamPlayerId, "event-1", CancellationToken.None);

            var notifications = await db.Notifications
                .Where(n => n.Type == "ConvocationCreated" && (n.UserId == playerUserId || n.UserId == familyUserId))
                .ToListAsync();

            Assert.Equal(2, notifications.Count);
            Assert.Contains(notifications, n => n.UserId == playerUserId);
            Assert.Contains(notifications, n => n.UserId == familyUserId);
        }

        [Fact]
        public async Task DispatchConvocationCreatedAsync_IncludesPlayerAliasEventNameAndDate_AndDeepLinksToAttendanceEvent()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var alias = (await db.TeamPlayers.Include(tp => tp.Player).FirstAsync(tp => tp.Id == teamPlayerId)).Player.Alias;

            var familyMember = TeamPlayerFamilyMember.Create(teamPlayerId, "Ana", "García", "600000000", "ana@test.com", null, "Mother");
            db.Set<TeamPlayerFamilyMember>().Add(familyMember);
            await db.SaveChangesAsync();
            var familyUserId = Guid.NewGuid().ToString();
            familyMember.LinkAccount(familyUserId);
            await db.SaveChangesAsync();

            var eventDate = new DateTime(2026, 10, 15, 18, 0, 0, DateTimeKind.Utc);
            var sportEvent = SportEvent.CreateNew(
                "Partido vs Rival CF", eventDate, eventDate,
                null, null, null, null, eventTypeId: 1, teamId, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();

            var senderMock = new Mock<IWebPushSender>();
            var dispatcher = new WebPushNotificationDispatcher(db, senderMock.Object);

            await dispatcher.DispatchConvocationCreatedAsync(teamPlayerId, sportEvent.Id, CancellationToken.None);

            var notification = await db.Notifications.SingleAsync(n => n.Type == "ConvocationCreated" && n.UserId == familyUserId);
            Assert.Contains(alias, notification.Body);
            Assert.Contains("Partido vs Rival CF", notification.Body);
            Assert.Contains("15/10/2026", notification.Body);
            Assert.Equal($"/coach/attendance/{sportEvent.Id}", notification.DeepLinkPath);
        }

        [Fact]
        public async Task DispatchConvocationCreatedAsync_DoesNotNotifyFamilyMemberWithoutLinkedAccount()
        {
            await using var db = _fixture.CreateDbContext();
            var (_, teamPlayerId) = await SeedTeamAndPlayerAsync(db);

            var familyMember = TeamPlayerFamilyMember.Create(teamPlayerId, "Ana", "García", "600000000", "ana@test.com", null, "Mother");
            db.Set<TeamPlayerFamilyMember>().Add(familyMember);
            await db.SaveChangesAsync();

            var countBefore = await db.Notifications.CountAsync();

            var senderMock = new Mock<IWebPushSender>();
            var dispatcher = new WebPushNotificationDispatcher(db, senderMock.Object);

            await dispatcher.DispatchConvocationCreatedAsync(teamPlayerId, "event-1", CancellationToken.None);

            var countAfter = await db.Notifications.CountAsync();
            Assert.Equal(countBefore, countAfter);
        }

        [Fact]
        public async Task DispatchConvocationStatusChangedAsync_NotifiesTeamCoach()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);

            var coachUserId = Guid.NewGuid().ToString();
            db.Set<UserTeam>().Add(new UserTeam(coachUserId, teamId, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var sportEvent = SportEvent.CreateNew(
                "WebPush Test Event", DateTime.UtcNow.AddDays(1), DateTime.UtcNow.AddDays(1),
                null, null, null, null, eventTypeId: 1, teamId, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();

            var convocation = Convocation.Create(new ConvocationModel
            {
                EventId = sportEvent.Id,
                TeamPlayerId = teamPlayerId,
                AssistanceTypeId = null,
                ResponseDateTime = DateTime.UtcNow,
                ConvocationStatusId = 1,
                ExcuseTypeId = null
            });
            db.Convocations.Add(convocation);
            await db.SaveChangesAsync();

            var senderMock = new Mock<IWebPushSender>();
            var dispatcher = new WebPushNotificationDispatcher(db, senderMock.Object);

            await dispatcher.DispatchConvocationStatusChangedAsync(convocation.Id, CancellationToken.None);

            var notifications = await db.Notifications
                .Where(n => n.Type == "ConvocationStatusChanged" && n.UserId == coachUserId)
                .ToListAsync();
            Assert.Single(notifications);
        }

        [Theory]
        [InlineData(2, "ha aceptado")]
        [InlineData(5, "ha rechazado")]
        [InlineData(4, "ha justificado su ausencia en")]
        public async Task DispatchConvocationStatusChangedAsync_IncludesPlayerAliasStatusEventNameAndDate_AndDeepLinksToAttendanceEvent(
            int convocationStatusId, string expectedVerbPhrase)
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var alias = (await db.TeamPlayers.Include(tp => tp.Player).FirstAsync(tp => tp.Id == teamPlayerId)).Player.Alias;

            var coachUserId = Guid.NewGuid().ToString();
            db.Set<UserTeam>().Add(new UserTeam(coachUserId, teamId, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var eventDate = new DateTime(2026, 10, 15, 18, 0, 0, DateTimeKind.Utc);
            var sportEvent = SportEvent.CreateNew(
                "Partido vs Rival CF", eventDate, eventDate,
                null, null, null, null, eventTypeId: 1, teamId, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();

            var convocation = Convocation.Create(new ConvocationModel
            {
                EventId = sportEvent.Id,
                TeamPlayerId = teamPlayerId,
                AssistanceTypeId = null,
                ResponseDateTime = DateTime.UtcNow,
                ConvocationStatusId = convocationStatusId,
                ExcuseTypeId = null
            });
            db.Convocations.Add(convocation);
            await db.SaveChangesAsync();

            var senderMock = new Mock<IWebPushSender>();
            var dispatcher = new WebPushNotificationDispatcher(db, senderMock.Object);

            await dispatcher.DispatchConvocationStatusChangedAsync(convocation.Id, CancellationToken.None);

            var notification = await db.Notifications.SingleAsync(n => n.Type == "ConvocationStatusChanged" && n.UserId == coachUserId);
            Assert.Contains(alias, notification.Body);
            Assert.Contains(expectedVerbPhrase, notification.Body);
            Assert.Contains("Partido vs Rival CF", notification.Body);
            Assert.Contains("15/10/2026", notification.Body);
            Assert.Equal($"/coach/attendance/{sportEvent.Id}", notification.DeepLinkPath);
        }

        /// <summary>
        /// Regression test: a coach who joined via club invitation code (UserClub.RoleId=Coach)
        /// has no UserTeam row for this specific team — they manage it via club-wide access
        /// (see TeamEditAuthorization.CanEditAsync) — but still must be notified, same as a
        /// coach with an explicit per-team UserTeam row.
        /// </summary>
        [Fact]
        public async Task DispatchConvocationStatusChangedAsync_NotifiesClubLevelCoachWithNoUserTeamRow()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var clubId = (await db.Teams.FirstAsync(t => t.Id == teamId)).ClubId;

            var coachUserId = Guid.NewGuid().ToString();
            db.Set<UserClub>().Add(new UserClub(coachUserId, clubId, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var sportEvent = SportEvent.CreateNew(
                "WebPush Test Event", DateTime.UtcNow.AddDays(1), DateTime.UtcNow.AddDays(1),
                null, null, null, null, eventTypeId: 1, teamId, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();

            var convocation = Convocation.Create(new ConvocationModel
            {
                EventId = sportEvent.Id,
                TeamPlayerId = teamPlayerId,
                AssistanceTypeId = null,
                ResponseDateTime = DateTime.UtcNow,
                ConvocationStatusId = 1,
                ExcuseTypeId = null
            });
            db.Convocations.Add(convocation);
            await db.SaveChangesAsync();

            var senderMock = new Mock<IWebPushSender>();
            var dispatcher = new WebPushNotificationDispatcher(db, senderMock.Object);

            await dispatcher.DispatchConvocationStatusChangedAsync(convocation.Id, CancellationToken.None);

            var notifications = await db.Notifications
                .Where(n => n.Type == "ConvocationStatusChanged" && n.UserId == coachUserId)
                .ToListAsync();
            Assert.Single(notifications);
        }

        [Fact]
        public async Task DispatchSanctionChangedAsync_NotifiesPlayerFamilyWithHighlightDeepLink()
        {
            await using var db = _fixture.CreateDbContext();
            var (_, teamPlayerId) = await SeedTeamAndPlayerAsync(db);

            var familyMember = TeamPlayerFamilyMember.Create(teamPlayerId, "Ana", "García", "600000000", "ana@test.com", null, "Mother");
            db.Set<TeamPlayerFamilyMember>().Add(familyMember);
            await db.SaveChangesAsync();
            var familyUserId = Guid.NewGuid().ToString();
            familyMember.LinkAccount(familyUserId);
            await db.SaveChangesAsync();

            var sanction = TeamPlayerSanction.Create(teamPlayerId, SanctionCategory.Competition, DateTime.UtcNow, "Tarjeta roja", null, null);
            db.TeamPlayerSanctions.Add(sanction);
            await db.SaveChangesAsync();

            var senderMock = new Mock<IWebPushSender>();
            var dispatcher = new WebPushNotificationDispatcher(db, senderMock.Object);

            await dispatcher.DispatchSanctionChangedAsync(sanction.Id, CancellationToken.None);

            var notification = await db.Notifications.SingleAsync(n => n.Type == "SanctionChanged" && n.UserId == familyUserId);
            Assert.Contains(sanction.Id, notification.DeepLinkPath);
        }

        [Fact]
        public async Task DispatchInjuryChangedAsync_NotifiesPlayerFamilyWithHighlightDeepLink()
        {
            await using var db = _fixture.CreateDbContext();
            var (_, teamPlayerId) = await SeedTeamAndPlayerAsync(db);

            var familyMember = TeamPlayerFamilyMember.Create(teamPlayerId, "Ana", "García", "600000000", "ana@test.com", null, "Mother");
            db.Set<TeamPlayerFamilyMember>().Add(familyMember);
            await db.SaveChangesAsync();
            var familyUserId = Guid.NewGuid().ToString();
            familyMember.LinkAccount(familyUserId);
            await db.SaveChangesAsync();

            var injury = TeamPlayerInjury.Create(teamPlayerId, DateTime.UtcNow, "Esguince", null, null);
            db.TeamPlayerInjuries.Add(injury);
            await db.SaveChangesAsync();

            var senderMock = new Mock<IWebPushSender>();
            var dispatcher = new WebPushNotificationDispatcher(db, senderMock.Object);

            await dispatcher.DispatchInjuryChangedAsync(injury.Id, CancellationToken.None);

            var notification = await db.Notifications.SingleAsync(n => n.Type == "InjuryChanged" && n.UserId == familyUserId);
            Assert.Contains(injury.Id, notification.DeepLinkPath);
        }

        [Fact]
        public async Task DispatchNewsPublishedAsync_NotifiesAllPlayerAndFamilyUsers()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _) = await SeedTeamAndPlayerAsync(db);

            var playerUserId = Guid.NewGuid().ToString();
            var familyUserId = Guid.NewGuid().ToString();
            var coachUserId = Guid.NewGuid().ToString();
            db.Set<UserTeam>().Add(new UserTeam(playerUserId, teamId, Membership.Player.Id));
            db.Set<UserTeam>().Add(new UserTeam(familyUserId, teamId, Membership.FamilyPlayer.Id));
            db.Set<UserTeam>().Add(new UserTeam(coachUserId, teamId, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var senderMock = new Mock<IWebPushSender>();
            var dispatcher = new WebPushNotificationDispatcher(db, senderMock.Object);

            await dispatcher.DispatchNewsPublishedAsync("news-1", CancellationToken.None);

            var notifications = await db.Notifications
                .Where(n => n.Type == "NewsPublished" && (n.UserId == playerUserId || n.UserId == familyUserId || n.UserId == coachUserId))
                .ToListAsync();

            Assert.Contains(notifications, n => n.UserId == playerUserId);
            Assert.Contains(notifications, n => n.UserId == familyUserId);
            Assert.DoesNotContain(notifications, n => n.UserId == coachUserId);
        }

        [Fact]
        public async Task Dispatch_WhenSenderThrows_DoesNotPropagateAndStillCreatesNotification()
        {
            await using var db = _fixture.CreateDbContext();
            var (_, teamPlayerId) = await SeedTeamAndPlayerAsync(db);

            var familyMember = TeamPlayerFamilyMember.Create(teamPlayerId, "Ana", "García", "600000000", "ana@test.com", null, "Mother");
            db.Set<TeamPlayerFamilyMember>().Add(familyMember);
            await db.SaveChangesAsync();
            var familyUserId = Guid.NewGuid().ToString();
            familyMember.LinkAccount(familyUserId);
            await db.SaveChangesAsync();

            var subscription = WebPushSubscription.Create(familyUserId, $"https://example.com/{Guid.NewGuid():N}", "p256dh", "auth");
            db.WebPushSubscriptions.Add(subscription);
            await db.SaveChangesAsync();

            var senderMock = new Mock<IWebPushSender>();
            senderMock.Setup(s => s.SendAsync(It.IsAny<WebPushSubscription>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("boom"));
            var dispatcher = new WebPushNotificationDispatcher(db, senderMock.Object);

            var exception = await Record.ExceptionAsync(
                () => dispatcher.DispatchConvocationCreatedAsync(teamPlayerId, "event-1", CancellationToken.None));

            Assert.Null(exception);
            var notification = await db.Notifications.SingleOrDefaultAsync(n => n.Type == "ConvocationCreated" && n.UserId == familyUserId);
            Assert.NotNull(notification);
        }

        [Fact]
        public async Task Dispatch_WhenSubscriptionIsGone_PrunesIt()
        {
            await using var db = _fixture.CreateDbContext();
            var (_, teamPlayerId) = await SeedTeamAndPlayerAsync(db);

            var familyMember = TeamPlayerFamilyMember.Create(teamPlayerId, "Ana", "García", "600000000", "ana@test.com", null, "Mother");
            db.Set<TeamPlayerFamilyMember>().Add(familyMember);
            await db.SaveChangesAsync();
            var familyUserId = Guid.NewGuid().ToString();
            familyMember.LinkAccount(familyUserId);
            await db.SaveChangesAsync();

            var subscription = WebPushSubscription.Create(familyUserId, $"https://example.com/{Guid.NewGuid():N}", "p256dh", "auth");
            db.WebPushSubscriptions.Add(subscription);
            await db.SaveChangesAsync();
            var subscriptionId = subscription.Id;

            var senderMock = new Mock<IWebPushSender>();
            senderMock.Setup(s => s.SendAsync(It.IsAny<WebPushSubscription>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(WebPushSendResult.SubscriptionGone);
            var dispatcher = new WebPushNotificationDispatcher(db, senderMock.Object);

            await dispatcher.DispatchConvocationCreatedAsync(teamPlayerId, "event-1", CancellationToken.None);

            var stillExists = await db.WebPushSubscriptions.AnyAsync(s => s.Id == subscriptionId);
            Assert.False(stillExists);
        }
    }
}
