#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Audit;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Audit;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class SearchAuditLogHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;
        public SearchAuditLogHandlerTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private const int SeededCountryId = 1;

        private static string RandomClubId() => "club-" + Guid.NewGuid().ToString("N").Substring(0, 6);
        private static string RandomTeamId() => "team-" + Guid.NewGuid().ToString("N").Substring(0, 6);
        private static string RandomUserId() => "user-" + Guid.NewGuid().ToString("N").Substring(0, 6);

        private static Mock<UserManager<IdentityUser>> MockUserManager()
        {
            var store = new Mock<IUserStore<IdentityUser>>();
            return new Mock<UserManager<IdentityUser>>(
                store.Object, null!, null!, null!, null!, null!, null!, null!, null!);
        }

        private static async Task<Team> SeedTeamAsync(AppDbContext db, string clubName)
        {
            var club = Club.Create(clubName, SeededCountryId);
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
                Name = "Audit Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return team;
        }

        [Fact]
        public async Task Handle_FederationRole_ReturnsAllRows()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = RandomUserId();
            var club1 = RandomClubId();
            var club2 = RandomClubId();
            var team1 = RandomTeamId();
            var team2 = RandomTeamId();

            // Seed audit logs from different clubs/teams
            var auditLog1 = UserActivityLog.Create(
                userId: RandomUserId(),
                roleName: "Coach",
                clubId: club1,
                teamId: team1,
                ipAddress: "192.168.1.1",
                eventType: AuditEventType.PageAccess,
                actionOrPage: "Roster",
                result: "Success",
                reason: null,
                subjectId: null
            );
            var auditLog2 = UserActivityLog.Create(
                userId: RandomUserId(),
                roleName: "Coach",
                clubId: club2,
                teamId: team2,
                ipAddress: "192.168.1.2",
                eventType: AuditEventType.ConvocationAccepted,
                actionOrPage: "ConvocationStatusChanged",
                result: "Success",
                reason: null,
                subjectId: "conv-123"
            );
            db.UserActivityLogs.Add(auditLog1);
            db.UserActivityLogs.Add(auditLog2);
            await db.SaveChangesAsync();

            var currentUserMock = new Mock<ICurrentUserService>();
            currentUserMock.Setup(s => s.UserId).Returns(userId);
            currentUserMock.Setup(s => s.Role).Returns("Federation");
            currentUserMock.Setup(s => s.Roles).Returns(new[] { "Federation" });

            var userManagerMock = MockUserManager();

            var handler = new SearchAuditLog.SearchAuditLogHandler(db, currentUserMock.Object, userManagerMock.Object);

            // Federation has no scope restriction: it must see rows from both, unrelated clubs.
            var (resultClub1, totalClub1) = await handler.Handle(
                new SearchAuditLog.SearchAuditLogQuery(1, 25, ClubId: club1), CancellationToken.None);
            var (resultClub2, totalClub2) = await handler.Handle(
                new SearchAuditLog.SearchAuditLogQuery(1, 25, ClubId: club2), CancellationToken.None);

            Assert.Single(resultClub1);
            Assert.Equal(1, totalClub1);
            Assert.Single(resultClub2);
            Assert.Equal(1, totalClub2);
        }

        [Fact]
        public async Task Handle_ReturnsUserNameAndAllCurrentRolesOfTheUser()
        {
            await using var db = _fixture.CreateDbContext();
            var callerId = RandomUserId();
            var subjectUserId = RandomUserId();

            // Event was recorded while acting as "Coach", but the user currently also holds "ClubDirector"
            var auditLog = UserActivityLog.Create(
                userId: subjectUserId,
                roleName: "Coach",
                clubId: RandomClubId(),
                teamId: RandomTeamId(),
                ipAddress: "192.168.1.1",
                eventType: AuditEventType.PageAccess,
                actionOrPage: "Roster",
                result: "Success",
                reason: null,
                subjectId: null
            );
            db.UserActivityLogs.Add(auditLog);
            await db.SaveChangesAsync();

            var currentUserMock = new Mock<ICurrentUserService>();
            currentUserMock.Setup(s => s.UserId).Returns(callerId);
            currentUserMock.Setup(s => s.Role).Returns("Federation");
            currentUserMock.Setup(s => s.Roles).Returns(new[] { "Federation" });

            var identityUser = new IdentityUser { Id = subjectUserId, UserName = "carlos.entrenador", Email = "carlos@test.com" };
            var userManagerMock = MockUserManager();
            userManagerMock.Setup(m => m.FindByIdAsync(subjectUserId)).ReturnsAsync(identityUser);
            userManagerMock.Setup(m => m.GetRolesAsync(identityUser)).ReturnsAsync(new List<string> { "Coach", "ClubDirector" });

            var handler = new SearchAuditLog.SearchAuditLogHandler(db, currentUserMock.Object, userManagerMock.Object);
            var query = new SearchAuditLog.SearchAuditLogQuery(1, 25, UserId: subjectUserId);

            var (result, _) = await handler.Handle(query, CancellationToken.None);

            var item = Assert.Single(result);
            Assert.Equal("carlos.entrenador", item.UserName);
            Assert.Equal(new[] { "Coach", "ClubDirector" }, item.Roles);
        }

        [Fact]
        public async Task Handle_UserLinkedToPlayer_ReturnsPlayerTeamAndClubNames()
        {
            await using var db = _fixture.CreateDbContext();
            var callerId = RandomUserId();
            var team = await SeedTeamAsync(db, $"Test Club {Guid.NewGuid():N}");
            var club = await db.Clubs.FirstAsync(c => c.Id == team.ClubId);
            var season = await db.Seasons.FirstAsync(s => s.ClubId == club.Id);

            var player = Player.Create(new PlayerModelBase
            {
                Name = "Hijo",
                LastName = "DePrueba",
                Alias = $"hijo-{Guid.NewGuid():N}",
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
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            var familyUserId = RandomUserId();
            var familyLink = new UserTeam(familyUserId, team.Id, Membership.FamilyPlayer.Id);
            familyLink.LinkPlayer(teamPlayer.Id);
            db.UserTeams.Add(familyLink);
            await db.SaveChangesAsync();

            var auditLog = UserActivityLog.Create(
                userId: familyUserId,
                roleName: "FamilyMember",
                clubId: club.Id,
                teamId: team.Id,
                ipAddress: "192.168.1.1",
                eventType: AuditEventType.PageAccess,
                actionOrPage: "Roster",
                result: "Success",
                reason: null,
                subjectId: null
            );
            db.UserActivityLogs.Add(auditLog);
            await db.SaveChangesAsync();

            var currentUserMock = new Mock<ICurrentUserService>();
            currentUserMock.Setup(s => s.UserId).Returns(callerId);
            currentUserMock.Setup(s => s.Roles).Returns(new[] { "Federation" });

            var userManagerMock = MockUserManager();
            userManagerMock.Setup(m => m.FindByIdAsync(familyUserId))
                .ReturnsAsync(new IdentityUser { Id = familyUserId, UserName = "familia.prueba" });
            userManagerMock.Setup(m => m.GetRolesAsync(It.IsAny<IdentityUser>()))
                .ReturnsAsync(new List<string> { "FamilyMember" });

            var handler = new SearchAuditLog.SearchAuditLogHandler(db, currentUserMock.Object, userManagerMock.Object);
            var query = new SearchAuditLog.SearchAuditLogQuery(1, 25, UserId: familyUserId);

            var (result, _) = await handler.Handle(query, CancellationToken.None);

            var item = Assert.Single(result);
            Assert.Equal("Hijo DePrueba", item.LinkedPlayerFullName);
            Assert.Equal(player.Alias, item.LinkedPlayerAlias);
            Assert.Equal(team.Name, item.TeamName);
            Assert.Equal(club.Name, item.ClubName);
        }

        [Fact]
        public async Task Handle_EventWithoutExplicitClubOrTeam_FallsBackToUsersOwnMembership()
        {
            await using var db = _fixture.CreateDbContext();
            var callerId = RandomUserId();
            var team = await SeedTeamAsync(db, $"Test Club {Guid.NewGuid():N}");
            var club = await db.Clubs.FirstAsync(c => c.Id == team.ClubId);

            var coachId = RandomUserId();
            db.UserTeams.Add(new UserTeam(coachId, team.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            // Plain page-access event recorded without explicit clubId/teamId context.
            var auditLog = UserActivityLog.Create(
                userId: coachId,
                roleName: "Coach",
                clubId: null,
                teamId: null,
                ipAddress: "192.168.1.1",
                eventType: AuditEventType.PageAccess,
                actionOrPage: "Dashboard",
                result: "Success",
                reason: null,
                subjectId: null
            );
            db.UserActivityLogs.Add(auditLog);
            await db.SaveChangesAsync();

            var currentUserMock = new Mock<ICurrentUserService>();
            currentUserMock.Setup(s => s.UserId).Returns(callerId);
            currentUserMock.Setup(s => s.Roles).Returns(new[] { "Federation" });

            var userManagerMock = MockUserManager();
            userManagerMock.Setup(m => m.FindByIdAsync(coachId))
                .ReturnsAsync(new IdentityUser { Id = coachId, UserName = "coach.sinclub" });
            userManagerMock.Setup(m => m.GetRolesAsync(It.IsAny<IdentityUser>()))
                .ReturnsAsync(new List<string> { "Coach" });

            var handler = new SearchAuditLog.SearchAuditLogHandler(db, currentUserMock.Object, userManagerMock.Object);
            var query = new SearchAuditLog.SearchAuditLogQuery(1, 25, UserId: coachId);

            var (result, _) = await handler.Handle(query, CancellationToken.None);

            var item = Assert.Single(result);
            Assert.Equal(team.Name, item.TeamName);
            Assert.Equal(club.Name, item.ClubName);
        }

        [Fact]
        public async Task Handle_SearchByUsername_ReturnsMatchingUsersEvents()
        {
            await using var db = _fixture.CreateDbContext();
            var callerId = RandomUserId();
            var matchingUserId = RandomUserId();
            var otherUserId = RandomUserId();
            var uniqueToken = "zzsearchuser" + Guid.NewGuid().ToString("N").Substring(0, 6);

            db.UserActivityLogs.Add(UserActivityLog.Create(
                userId: matchingUserId, roleName: "Coach", clubId: null, teamId: null,
                ipAddress: null, eventType: AuditEventType.PageAccess, actionOrPage: "Dashboard",
                result: "Success", reason: null, subjectId: null));
            db.UserActivityLogs.Add(UserActivityLog.Create(
                userId: otherUserId, roleName: "Coach", clubId: null, teamId: null,
                ipAddress: null, eventType: AuditEventType.PageAccess, actionOrPage: "Dashboard",
                result: "Success", reason: null, subjectId: null));
            await db.SaveChangesAsync();

            var currentUserMock = new Mock<ICurrentUserService>();
            currentUserMock.Setup(s => s.UserId).Returns(callerId);
            currentUserMock.Setup(s => s.Roles).Returns(new[] { "Federation" });

            var userManagerMock = MockUserManager();
            var matchingIdentityUser = new IdentityUser { Id = matchingUserId, UserName = $"coach.{uniqueToken}" };
            userManagerMock.Setup(m => m.FindByIdAsync(matchingUserId)).ReturnsAsync(matchingIdentityUser);
            userManagerMock.Setup(m => m.FindByIdAsync(otherUserId))
                .ReturnsAsync(new IdentityUser { Id = otherUserId, UserName = "someone.else" });
            userManagerMock.Setup(m => m.GetRolesAsync(It.IsAny<IdentityUser>())).ReturnsAsync(new List<string> { "Coach" });
            userManagerMock.Setup(m => m.Users).Returns(new[] { matchingIdentityUser }.AsQueryable());

            var handler = new SearchAuditLog.SearchAuditLogHandler(db, currentUserMock.Object, userManagerMock.Object);
            var query = new SearchAuditLog.SearchAuditLogQuery(1, 25, Search: uniqueToken);

            var (result, _) = await handler.Handle(query, CancellationToken.None);

            var item = Assert.Single(result);
            Assert.Equal(matchingUserId, item.UserId);
        }

        [Fact]
        public async Task Handle_SearchByPlayerAlias_ReturnsLinkedUsersEvents()
        {
            await using var db = _fixture.CreateDbContext();
            var callerId = RandomUserId();
            var team = await SeedTeamAsync(db, $"Test Club {Guid.NewGuid():N}");
            var club = await db.Clubs.FirstAsync(c => c.Id == team.ClubId);
            var season = await db.Seasons.FirstAsync(s => s.ClubId == club.Id);
            var uniqueAlias = "zzplayeralias" + Guid.NewGuid().ToString("N").Substring(0, 6);

            var player = Player.Create(new PlayerModelBase
            {
                Name = "Hijo",
                LastName = "DePrueba",
                Alias = uniqueAlias,
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
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            var familyUserId = RandomUserId();
            var familyLink = new UserTeam(familyUserId, team.Id, Membership.FamilyPlayer.Id);
            familyLink.LinkPlayer(teamPlayer.Id);
            db.UserTeams.Add(familyLink);
            await db.SaveChangesAsync();

            db.UserActivityLogs.Add(UserActivityLog.Create(
                userId: familyUserId, roleName: "FamilyMember", clubId: club.Id, teamId: team.Id,
                ipAddress: null, eventType: AuditEventType.PageAccess, actionOrPage: "Roster",
                result: "Success", reason: null, subjectId: null));
            await db.SaveChangesAsync();

            var currentUserMock = new Mock<ICurrentUserService>();
            currentUserMock.Setup(s => s.UserId).Returns(callerId);
            currentUserMock.Setup(s => s.Roles).Returns(new[] { "Federation" });

            var userManagerMock = MockUserManager();
            userManagerMock.Setup(m => m.FindByIdAsync(familyUserId))
                .ReturnsAsync(new IdentityUser { Id = familyUserId, UserName = "familia.prueba" });
            userManagerMock.Setup(m => m.GetRolesAsync(It.IsAny<IdentityUser>())).ReturnsAsync(new List<string> { "FamilyMember" });
            userManagerMock.Setup(m => m.Users).Returns(Array.Empty<IdentityUser>().AsQueryable());

            var handler = new SearchAuditLog.SearchAuditLogHandler(db, currentUserMock.Object, userManagerMock.Object);
            var query = new SearchAuditLog.SearchAuditLogQuery(1, 25, Search: uniqueAlias);

            var (result, _) = await handler.Handle(query, CancellationToken.None);

            var item = Assert.Single(result);
            Assert.Equal(familyUserId, item.UserId);
        }
    }
}
