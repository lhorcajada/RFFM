#nullable enable
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.Convocations;
using RFFM.Api.Features.Coaches.Notifications.Services;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class SendConvocationRemindersTests
    {
        private readonly PostgresContainerFixture _fixture;
        private static readonly int PendingStatusId = ConvocationStatus.FromName("Pending").Id;
        private static readonly int AcceptedStatusId = ConvocationStatus.FromName("Accepted").Id;

        public SendConvocationRemindersTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private sealed record Seed(string TeamId, string EventId, DateTime EventDate, string EventName);

        private static async Task<Seed> SeedTeamAndEventAsync(AppDbContext db)
        {
            var club = Club.Create($"Reminder Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Reminder Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var eventDate = new DateTime(2026, 10, 15, 18, 0, 0, DateTimeKind.Utc);
            var sportEvent = SportEvent.CreateNew(
                "Partido vs Rival CF", eventDate, eventDate,
                null, null, null, null, eventTypeId: 1, team.Id, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();

            return new Seed(team.Id, sportEvent.Id, eventDate, sportEvent.Name);
        }

        private static async Task<(string TeamPlayerId, string FamilyUserId, string Alias)> SeedConvokedPlayerWithFamilyAsync(
            AppDbContext db, Seed seed, int convocationStatusId)
        {
            var team = await db.Teams.AsNoTracking().FirstAsync(t => t.Id == seed.TeamId);
            var alias = $"reminder-player-{Guid.NewGuid():N}";
            var player = Player.Create(new PlayerModelBase { Name = "Test", LastName = "Player", Alias = alias, ClubId = team.ClubId });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = team.Id,
                SeasonId = team.SeasonId,
                JoinedDate = DateTime.UtcNow,
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            var familyMember = TeamPlayerFamilyMember.Create(teamPlayer.Id, "Ana", "García", "600000000", "ana@test.com", null, "Mother");
            db.Set<TeamPlayerFamilyMember>().Add(familyMember);
            await db.SaveChangesAsync();
            var familyUserId = Guid.NewGuid().ToString();
            familyMember.LinkAccount(familyUserId);
            await db.SaveChangesAsync();

            db.Convocations.Add(Convocation.Create(new ConvocationModel
            {
                EventId = seed.EventId,
                TeamPlayerId = teamPlayer.Id,
                AssistanceTypeId = null,
                ConvocationStatusId = convocationStatusId
            }));
            await db.SaveChangesAsync();

            return (teamPlayer.Id, familyUserId, alias);
        }

        private static async Task<string> SeedTeamCoachAsync(AppDbContext db, string teamId)
        {
            var coachUserId = Guid.NewGuid().ToString();
            db.Set<UserTeam>().Add(new UserTeam(coachUserId, teamId, Membership.Coach.Id));
            await db.SaveChangesAsync();
            return coachUserId;
        }

        private static ICurrentUserService CurrentUser(string userId, params string[] roles)
        {
            var mock = new Mock<ICurrentUserService>();
            mock.Setup(c => c.UserId).Returns(userId);
            mock.Setup(c => c.IsAuthenticated).Returns(true);
            mock.Setup(c => c.Roles).Returns(roles);
            return mock.Object;
        }

        private static SendConvocationReminders.Handler CreateHandler(AppDbContext db, ICurrentUserService currentUser)
            => new(db, currentUser, new WebPushNotificationDispatcher(db, Mock.Of<IWebPushSender>()));

        [Fact]
        public async Task DispatchConvocationReminderAsync_IncludesAliasEventNameAndDate_AndDeepLinksToAttendanceEvent()
        {
            await using var db = _fixture.CreateDbContext();
            var seed = await SeedTeamAndEventAsync(db);
            var (teamPlayerId, familyUserId, alias) = await SeedConvokedPlayerWithFamilyAsync(db, seed, PendingStatusId);
            var dispatcher = new WebPushNotificationDispatcher(db, Mock.Of<IWebPushSender>());

            await dispatcher.DispatchConvocationReminderAsync(teamPlayerId, seed.EventId, CancellationToken.None);

            var notification = await db.Notifications.SingleAsync(n => n.Type == "ConvocationReminder" && n.UserId == familyUserId);
            Assert.Contains(alias, notification.Body);
            Assert.Contains(seed.EventName, notification.Body);
            Assert.Contains("15/10/2026", notification.Body);
            Assert.Equal($"/coach/attendance/{seed.EventId}", notification.DeepLinkPath);
        }

        [Fact]
        public async Task Handle_CoachOfTeam_NotifiesSelectedPendingPlayers()
        {
            await using var db = _fixture.CreateDbContext();
            var seed = await SeedTeamAndEventAsync(db);
            var coachUserId = await SeedTeamCoachAsync(db, seed.TeamId);
            var (teamPlayerId, familyUserId, _) = await SeedConvokedPlayerWithFamilyAsync(db, seed, PendingStatusId);

            var result = await CreateHandler(db, CurrentUser(coachUserId, "Coach")).Handle(
                new SendConvocationReminders.SendConvocationRemindersCommand(seed.EventId, new[] { teamPlayerId }),
                CancellationToken.None);

            Assert.Equal(1, result.NotifiedCount);
            Assert.True(await db.Notifications.AnyAsync(n => n.Type == "ConvocationReminder" && n.UserId == familyUserId));
        }

        [Fact]
        public async Task Handle_SkipsSelectedPlayersWhoseConvocationIsNoLongerPending()
        {
            await using var db = _fixture.CreateDbContext();
            var seed = await SeedTeamAndEventAsync(db);
            var coachUserId = await SeedTeamCoachAsync(db, seed.TeamId);
            var (acceptedTeamPlayerId, acceptedFamilyUserId, _) = await SeedConvokedPlayerWithFamilyAsync(db, seed, AcceptedStatusId);

            var result = await CreateHandler(db, CurrentUser(coachUserId, "Coach")).Handle(
                new SendConvocationReminders.SendConvocationRemindersCommand(seed.EventId, new[] { acceptedTeamPlayerId }),
                CancellationToken.None);

            Assert.Equal(0, result.NotifiedCount);
            Assert.False(await db.Notifications.AnyAsync(n => n.Type == "ConvocationReminder" && n.UserId == acceptedFamilyUserId));
        }

        [Fact]
        public async Task Handle_CoachOfAnotherTeam_IsForbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var seed = await SeedTeamAndEventAsync(db);
            var (teamPlayerId, _, _) = await SeedConvokedPlayerWithFamilyAsync(db, seed, PendingStatusId);
            var foreignCoachUserId = Guid.NewGuid().ToString();

            await Assert.ThrowsAsync<ForbiddenAccessException>(() => CreateHandler(db, CurrentUser(foreignCoachUserId, "Coach")).Handle(
                new SendConvocationReminders.SendConvocationRemindersCommand(seed.EventId, new[] { teamPlayerId }),
                CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Handle_Administrator_CanNotifyWithoutTeamMembership()
        {
            await using var db = _fixture.CreateDbContext();
            var seed = await SeedTeamAndEventAsync(db);
            var (teamPlayerId, _, _) = await SeedConvokedPlayerWithFamilyAsync(db, seed, PendingStatusId);

            var result = await CreateHandler(db, CurrentUser(Guid.NewGuid().ToString(), "Administrator")).Handle(
                new SendConvocationReminders.SendConvocationRemindersCommand(seed.EventId, new[] { teamPlayerId }),
                CancellationToken.None);

            Assert.Equal(1, result.NotifiedCount);
        }

        [Fact]
        public async Task Handle_UnknownEvent_ThrowsNotFound()
        {
            await using var db = _fixture.CreateDbContext();

            await Assert.ThrowsAsync<NotFoundException>(() => CreateHandler(db, CurrentUser(Guid.NewGuid().ToString(), "Administrator")).Handle(
                new SendConvocationReminders.SendConvocationRemindersCommand("missing-event", new[] { "tp-1" }),
                CancellationToken.None).AsTask());
        }

        [Fact]
        public void Validator_RejectsEmptyTeamPlayerIds()
        {
            var result = new SendConvocationReminders.Validator().Validate(
                new SendConvocationReminders.SendConvocationRemindersCommand("event-1", Array.Empty<string>()));

            Assert.False(result.IsValid);
        }
    }
}
