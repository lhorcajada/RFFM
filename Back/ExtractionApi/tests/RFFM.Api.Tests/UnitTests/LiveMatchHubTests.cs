#nullable enable
using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.SignalR;
using Moq;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.LiveMatches;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.LiveMatch;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class LiveMatchHubTests
    {
        private readonly PostgresContainerFixture _fixture;

        public LiveMatchHubTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(string TeamId, string ClubId)> SeedTeamAsync(AppDbContext db, string namePrefix)
        {
            var club = Club.Create($"{namePrefix} Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = $"{namePrefix} Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return (team.Id, club.Id);
        }

        private static async Task<string> SeedSportEventAsync(AppDbContext db, string teamId)
        {
            var sportEvent = SportEvent.CreateNew(
                "Amistoso",
                DateTime.UtcNow.AddDays(-1),
                DateTime.UtcNow.AddDays(-1),
                null, null, null, null,
                4, teamId, null,
                isHomeMatch: true);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();
            return sportEvent.Id;
        }

        private static (Mock<HubCallerContext> Context, Mock<IGroupManager> Groups) CreateHubMocks(string userId, string connectionId)
        {
            var principal = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, userId) }, "test"));

            var context = new Mock<HubCallerContext>();
            context.Setup(c => c.ConnectionId).Returns(connectionId);
            context.Setup(c => c.User).Returns(principal);

            var groups = new Mock<IGroupManager>();
            groups.Setup(g => g.AddToGroupAsync(connectionId, It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            return (context, groups);
        }

        [Fact]
        public void GroupName_EventId_ReturnsPerMatchGroup()
        {
            var name = LiveMatchHub.GroupName("e1");

            Assert.Equal("liveMatch-e1", name);
        }

        [Fact]
        public async Task JoinMatch_TeamCoach_AddsConnectionToEventGroup()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _) = await SeedTeamAsync(db, "HubJoinCoach");
            var eventId = await SeedSportEventAsync(db, teamId);
            var coachId = Guid.NewGuid().ToString();
            db.UserTeams.Add(new UserTeam(coachId, teamId, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var (context, groups) = CreateHubMocks(coachId, "conn-coach");
            var hub = new LiveMatchHub(db) { Context = context.Object, Groups = groups.Object };

            await hub.JoinMatch(eventId);

            groups.Verify(g => g.AddToGroupAsync("conn-coach", $"liveMatch-{eventId}", It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task JoinMatch_NonCoach_ThrowsHubExceptionAndAddsNoGroup()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _) = await SeedTeamAsync(db, "HubJoinOutsider");
            var eventId = await SeedSportEventAsync(db, teamId);
            var outsiderId = Guid.NewGuid().ToString();

            var (context, groups) = CreateHubMocks(outsiderId, "conn-outsider");
            var hub = new LiveMatchHub(db) { Context = context.Object, Groups = groups.Object };

            await Assert.ThrowsAsync<HubException>(() => hub.JoinMatch(eventId));
            groups.Verify(g => g.AddToGroupAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task JoinMatch_SameDecisionAsRestCheck_AllowsCoachAndRejectsPlayer()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _) = await SeedTeamAsync(db, "HubSameDecision");
            var eventId = await SeedSportEventAsync(db, teamId);
            var coachId = Guid.NewGuid().ToString();
            var playerId = Guid.NewGuid().ToString();
            db.UserTeams.Add(new UserTeam(coachId, teamId, Membership.Coach.Id));
            db.UserTeams.Add(new UserTeam(playerId, teamId, Membership.Player.Id));
            await db.SaveChangesAsync();

            var coachRest = await LiveMatchTeamAccess.IsTeamCoachAsync(db, coachId, eventId, CancellationToken.None);
            var playerRest = await LiveMatchTeamAccess.IsTeamCoachAsync(db, playerId, eventId, CancellationToken.None);
            Assert.True(coachRest);
            Assert.False(playerRest);

            var (coachContext, coachGroups) = CreateHubMocks(coachId, "conn-same-coach");
            var coachHub = new LiveMatchHub(db) { Context = coachContext.Object, Groups = coachGroups.Object };
            await coachHub.JoinMatch(eventId);

            var (playerContext, playerGroups) = CreateHubMocks(playerId, "conn-same-player");
            var playerHub = new LiveMatchHub(db) { Context = playerContext.Object, Groups = playerGroups.Object };
            await Assert.ThrowsAsync<HubException>(() => playerHub.JoinMatch(eventId));
        }

        [Fact]
        public async Task LeaveMatch_ConnectedCoach_RemovesConnectionFromEventGroup()
        {
            await using var db = _fixture.CreateDbContext();
            var eventId = Guid.NewGuid().ToString();

            var (context, groups) = CreateHubMocks(Guid.NewGuid().ToString(), "conn-leave");
            groups.Setup(g => g.RemoveFromGroupAsync("conn-leave", It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            var hub = new LiveMatchHub(db) { Context = context.Object, Groups = groups.Object };

            await hub.LeaveMatch(eventId);

            groups.Verify(g => g.RemoveFromGroupAsync("conn-leave", $"liveMatch-{eventId}", It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task BroadcastUpdatedAsync_SendsOneMatchUpdatedToEventGroup()
        {
            var eventId = "e1";
            var state = new LiveMatchStateResponse(eventId, "t1", 8, LiveMatchPhases.FirstHalf,
                new LiveMatchClockResponse(0, null), 60, 1, 0, "4-4-2",
                new LiveMatchMatchDataResponse(null, null, null, null, null, null, null), false,
                new DateTime(2026, 11, 4, 10, 12, 0, DateTimeKind.Utc));

            var proxy = new Mock<IClientProxy>();
            var clients = new Mock<IHubClients>();
            clients.Setup(c => c.Group($"liveMatch-{eventId}")).Returns(proxy.Object);
            var hubContext = new Mock<IHubContext<LiveMatchHub>>();
            hubContext.Setup(h => h.Clients).Returns(clients.Object);

            var broadcaster = new LiveMatchBroadcaster(hubContext.Object);

            await broadcaster.BroadcastUpdatedAsync(eventId, state, CancellationToken.None);

            proxy.Verify(p => p.SendCoreAsync(
                "MatchUpdated",
                It.Is<object?[]>(args => args.Length == 1 && ReferenceEquals(args[0], state)),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task BroadcastDeletedAsync_SendsOneMatchDeletedToEventGroup()
        {
            var eventId = "e1";

            var proxy = new Mock<IClientProxy>();
            var clients = new Mock<IHubClients>();
            clients.Setup(c => c.Group($"liveMatch-{eventId}")).Returns(proxy.Object);
            var hubContext = new Mock<IHubContext<LiveMatchHub>>();
            hubContext.Setup(h => h.Clients).Returns(clients.Object);

            var broadcaster = new LiveMatchBroadcaster(hubContext.Object);

            await broadcaster.BroadcastDeletedAsync(eventId, CancellationToken.None);

            proxy.Verify(p => p.SendCoreAsync(
                "MatchDeleted",
                It.Is<object?[]>(args => args.Length == 1 && (string?)args[0] == eventId),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public void AllowsQueryStringToken_HubPath_ReturnsTrue()
        {
            var result = LiveMatchHubAuthentication.AllowsQueryStringToken(new PathString("/hubs/live-match"));

            Assert.True(result);
        }

        [Fact]
        public void AllowsQueryStringToken_ApiPath_ReturnsFalse()
        {
            var hubPath = LiveMatchHubAuthentication.AllowsQueryStringToken(new PathString("/hubs/live-match"));
            var apiPath = LiveMatchHubAuthentication.AllowsQueryStringToken(new PathString("/api/events/e1/live-match"));

            Assert.True(hubPath);
            Assert.False(apiPath);
        }
    }
}
