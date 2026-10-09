#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Features.Coaches.Notifications.Services;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.UnitTests.AvailabilityTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class AvailabilityNotificationTests
    {
        private readonly PostgresContainerFixture _fixture;

        public AvailabilityNotificationTests(PostgresContainerFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task Availability_requested_notifies_player_and_family_with_date_and_time()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var alias = $"Lucas-{Guid.NewGuid():N}";
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId, alias);
            var eventDate = new DateTime(2026, 10, 18, 11, 30, 0, DateTimeKind.Utc);
            var eventId = await SeedEventAsync(db, teamId, LeagueMatchTypeId, eventDate, "Jornada 5 - CD Ejemplo");

            var playerUserId = Guid.NewGuid().ToString();
            var playerUserTeam = new UserTeam(playerUserId, teamId, Membership.Player.Id);
            db.Set<UserTeam>().Add(playerUserTeam);
            await db.SaveChangesAsync();
            playerUserTeam.LinkPlayer(teamPlayerId);
            var family = TeamPlayerFamilyMember.Create(teamPlayerId, "Ana", "García", "600000000", "ana@test.com", null, "Mother");
            db.Set<TeamPlayerFamilyMember>().Add(family);
            await db.SaveChangesAsync();
            var familyUserId = Guid.NewGuid().ToString();
            family.LinkAccount(familyUserId);
            await db.SaveChangesAsync();

            var dispatcher = new WebPushNotificationDispatcher(db, Mock.Of<IWebPushSender>());
            await dispatcher.DispatchAvailabilityRequestedAsync(teamPlayerId, eventId, CancellationToken.None);

            var notifications = await db.Notifications
                .Where(n => n.Type == "AvailabilityRequested" && (n.UserId == playerUserId || n.UserId == familyUserId))
                .ToListAsync();
            Assert.Equal(2, notifications.Count);
            Assert.All(notifications, n =>
            {
                Assert.Equal($"¿{alias}, estás disponible para el partido «Jornada 5 - CD Ejemplo» el próximo 18/10 a las 11:30?", n.Body);
                Assert.Equal($"/coach/attendance/{eventId}", n.DeepLinkPath);
            });
        }

        [Fact]
        public async Task Availability_requested_without_time_omits_the_hour()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var alias = $"Lucas-{Guid.NewGuid():N}";
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId, alias);
            var eventDate = new DateTime(2026, 10, 18, 0, 0, 0, DateTimeKind.Utc);
            var sportEvent = SportEvent.CreateNew("Jornada 6", eventDate, null, null, null, null, null, LeagueMatchTypeId, teamId, null);
            db.SportEvents.Add(sportEvent);
            var family = TeamPlayerFamilyMember.Create(teamPlayerId, "Ana", "García", "600000000", "ana@test.com", null, "Mother");
            db.Set<TeamPlayerFamilyMember>().Add(family);
            await db.SaveChangesAsync();
            var familyUserId = Guid.NewGuid().ToString();
            family.LinkAccount(familyUserId);
            await db.SaveChangesAsync();

            var dispatcher = new WebPushNotificationDispatcher(db, Mock.Of<IWebPushSender>());
            await dispatcher.DispatchAvailabilityRequestedAsync(teamPlayerId, sportEvent.Id, CancellationToken.None);

            var notification = await db.Notifications.SingleAsync(n => n.Type == "AvailabilityRequested" && n.UserId == familyUserId);
            Assert.Equal($"¿{alias}, estás disponible para el partido «Jornada 6» el próximo 18/10?", notification.Body);
        }

        [Theory]
        [InlineData(true, null, "está disponible para Jornada 7 el 18/10/2026.")]
        [InlineData(false, 3, "no está disponible para Jornada 7 el 18/10/2026 (Enfermedad).")]
        public async Task Availability_responded_notifies_team_coaches(bool available, int? excuseTypeId, string expectedSuffix)
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var alias = $"Lucas-{Guid.NewGuid():N}";
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId, alias);
            var eventId = await SeedEventAsync(db, teamId, LeagueMatchTypeId, new DateTime(2026, 10, 18, 11, 30, 0, DateTimeKind.Utc), "Jornada 7");
            var requestId = await SeedRequestAsync(db, eventId, teamPlayerId,
                available ? AvailabilityRequestStatus.Available : AvailabilityRequestStatus.Unavailable);
            if (!available) await SeedConvocationAsync(db, eventId, teamPlayerId, statusId: 5, excuseTypeId);
            var coachUserId = await SeedCoachAsync(db, teamId);

            var dispatcher = new WebPushNotificationDispatcher(db, Mock.Of<IWebPushSender>());
            await dispatcher.DispatchAvailabilityRespondedAsync(requestId, CancellationToken.None);

            var notification = await db.Notifications.SingleAsync(n => n.Type == "AvailabilityResponded" && n.UserId == coachUserId);
            Assert.Equal($"{alias} {expectedSuffix}", notification.Body);
            Assert.Equal($"/coach/attendance/{eventId}", notification.DeepLinkPath);
        }
    }
}
