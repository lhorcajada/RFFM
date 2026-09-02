#nullable enable
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.FamilyMemberAccounts.Commands;
using RFFM.Api.Features.Scopes;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class RegisterFamilyMemberAccountHandlerTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public RegisterFamilyMemberAccountHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static Mock<UserManager<IdentityUser>> MockUserManager()
        {
            var store = new Mock<IUserStore<IdentityUser>>();
            return new Mock<UserManager<IdentityUser>>(
                store.Object, null!, null!, null!, null!, null!, null!, null!, null!);
        }

        private static Mock<RoleManager<IdentityRole>> MockRoleManager()
        {
            var store = new Mock<IRoleStore<IdentityRole>>();
            return new Mock<RoleManager<IdentityRole>>(
                store.Object, null!, null!, null!, null!);
        }

        private static async Task<(Team Team, string TeamPlayerId, string FamilyMemberId, string CreatorUserId)> SeedAsync(
            AppDbContext db, string? familyMemberEmail = "jane@rffm.test")
        {
            var club = Club.Create($"FamilyAccounts Test Club {Guid.NewGuid():N}", SeededCountryId);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9),
                isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "FamilyAccounts Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "Marcos",
                LastName = "Muñoz",
                Alias = $"marcos-{Guid.NewGuid():N}",
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

            var familyMember = TeamPlayerFamilyMember.Create(
                teamPlayer.Id, "Jane", "Doe", "600123456", familyMemberEmail, "12345678A", "Mother");
            db.TeamPlayerFamilyMembers.Add(familyMember);
            await db.SaveChangesAsync();

            var creatorUserId = $"creator-{Guid.NewGuid():N}";
            var creatorLink = new UserTeam(creatorUserId, team.Id, Membership.Coach.Id);
            creatorLink.MarkAsCreator();
            db.UserTeams.Add(creatorLink);
            await db.SaveChangesAsync();

            return (team, teamPlayer.Id, familyMember.Id, creatorUserId);
        }

        [Fact]
        public async Task MissingEmail_ReturnsBadRequestAndCreatesNothing()
        {
            await using var db = _fixture.CreateDbContext();
            var (_, _, familyMemberId, creatorUserId) = await SeedAsync(db, familyMemberEmail: null);

            var userManagerMock = MockUserManager();
            var handler = new RegisterFamilyMemberAccountCommand.Handler(
                userManagerMock.Object, MockRoleManager().Object, db, new ScopeAuthorizationService(db),
                NullLogger<RegisterFamilyMemberAccountCommand.Handler>.Instance);

            var result = await handler.Handle(new RegisterFamilyMemberAccountCommand
            {
                FamilyMemberId = familyMemberId,
                CallerUserId = creatorUserId
            }, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status400BadRequest, statusCodeResult.StatusCode);

            var valueResult = Assert.IsAssignableFrom<IValueHttpResult<Microsoft.AspNetCore.Mvc.ProblemDetails>>(result);
            Assert.Equal(ErrorCodes.FamilyMemberEmailRequired, valueResult.Value!.Extensions["code"]);

            userManagerMock.Verify(m => m.CreateAsync(It.IsAny<IdentityUser>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task AlreadyLinkedFamilyMember_ReturnsConflict()
        {
            await using var db = _fixture.CreateDbContext();
            var (_, _, familyMemberId, creatorUserId) = await SeedAsync(db);

            var familyMember = await db.TeamPlayerFamilyMembers.FirstAsync(f => f.Id == familyMemberId);
            familyMember.LinkAccount($"existing-user-{Guid.NewGuid():N}");
            await db.SaveChangesAsync();

            var userManagerMock = MockUserManager();
            var handler = new RegisterFamilyMemberAccountCommand.Handler(
                userManagerMock.Object, MockRoleManager().Object, db, new ScopeAuthorizationService(db),
                NullLogger<RegisterFamilyMemberAccountCommand.Handler>.Instance);

            var result = await handler.Handle(new RegisterFamilyMemberAccountCommand
            {
                FamilyMemberId = familyMemberId,
                CallerUserId = creatorUserId
            }, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status409Conflict, statusCodeResult.StatusCode);

            var valueResult = Assert.IsAssignableFrom<IValueHttpResult<Microsoft.AspNetCore.Mvc.ProblemDetails>>(result);
            Assert.Equal(ErrorCodes.FamilyMemberAccountAlreadyLinked, valueResult.Value!.Extensions["code"]);
        }

        [Fact]
        public async Task PendingRequestAlreadyExists_ReturnsConflict()
        {
            await using var db = _fixture.CreateDbContext();
            var (team, teamPlayerId, familyMemberId, creatorUserId) = await SeedAsync(db);

            db.FamilyMemberAccountRequests.Add(
                FamilyMemberAccountRequest.Create($"other-user-{Guid.NewGuid():N}", familyMemberId, teamPlayerId));
            await db.SaveChangesAsync();

            var userManagerMock = MockUserManager();
            var handler = new RegisterFamilyMemberAccountCommand.Handler(
                userManagerMock.Object, MockRoleManager().Object, db, new ScopeAuthorizationService(db),
                NullLogger<RegisterFamilyMemberAccountCommand.Handler>.Instance);

            var result = await handler.Handle(new RegisterFamilyMemberAccountCommand
            {
                FamilyMemberId = familyMemberId,
                CallerUserId = creatorUserId
            }, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status409Conflict, statusCodeResult.StatusCode);

            var valueResult = Assert.IsAssignableFrom<IValueHttpResult<Microsoft.AspNetCore.Mvc.ProblemDetails>>(result);
            Assert.Equal(ErrorCodes.FamilyMemberAccountRequestAlreadyPending, valueResult.Value!.Extensions["code"]);
        }

        [Fact]
        public async Task UnauthorizedCaller_ReturnsForbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var (_, _, familyMemberId, _) = await SeedAsync(db);
            var outsiderId = $"outsider-{Guid.NewGuid():N}";

            var userManagerMock = MockUserManager();
            var handler = new RegisterFamilyMemberAccountCommand.Handler(
                userManagerMock.Object, MockRoleManager().Object, db, new ScopeAuthorizationService(db),
                NullLogger<RegisterFamilyMemberAccountCommand.Handler>.Instance);

            var result = await handler.Handle(new RegisterFamilyMemberAccountCommand
            {
                FamilyMemberId = familyMemberId,
                CallerUserId = outsiderId
            }, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status403Forbidden, statusCodeResult.StatusCode);
        }

        [Fact]
        public async Task FamilyMemberNotFound_ReturnsNotFound()
        {
            await using var db = _fixture.CreateDbContext();

            var userManagerMock = MockUserManager();
            var handler = new RegisterFamilyMemberAccountCommand.Handler(
                userManagerMock.Object, MockRoleManager().Object, db, new ScopeAuthorizationService(db),
                NullLogger<RegisterFamilyMemberAccountCommand.Handler>.Instance);

            var result = await handler.Handle(new RegisterFamilyMemberAccountCommand
            {
                FamilyMemberId = "does-not-exist",
                CallerUserId = $"caller-{Guid.NewGuid():N}"
            }, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status404NotFound, statusCodeResult.StatusCode);
        }

        [Fact]
        public async Task HappyPath_CreatesPendingIdentityUserWithNoRoleAndNoUserTeam()
        {
            await using var db = _fixture.CreateDbContext();
            var (_, teamPlayerId, familyMemberId, creatorUserId) = await SeedAsync(db);

            var userManagerMock = MockUserManager();
            userManagerMock.Setup(m => m.FindByNameAsync(It.IsAny<string>())).ReturnsAsync((IdentityUser?)null);
            userManagerMock
                .Setup(m => m.CreateAsync(It.IsAny<IdentityUser>(), It.IsAny<string>()))
                .ReturnsAsync(IdentityResult.Success)
                .Callback<IdentityUser, string>((u, _) => u.Id = $"new-user-{Guid.NewGuid():N}");

            var roleManagerMock = MockRoleManager();
            var handler = new RegisterFamilyMemberAccountCommand.Handler(
                userManagerMock.Object, roleManagerMock.Object, db, new ScopeAuthorizationService(db),
                NullLogger<RegisterFamilyMemberAccountCommand.Handler>.Instance);

            var result = await handler.Handle(new RegisterFamilyMemberAccountCommand
            {
                FamilyMemberId = familyMemberId,
                CallerUserId = creatorUserId
            }, CancellationToken.None);

            var okResult = Assert.IsAssignableFrom<IValueHttpResult<RegisterFamilyMemberAccountResponse>>(result);
            Assert.False(string.IsNullOrWhiteSpace(okResult.Value!.Alias));
            Assert.False(string.IsNullOrWhiteSpace(okResult.Value!.Password));
            Assert.Equal("Pending", okResult.Value!.Status);
            Assert.Matches(@"^Marcos\d{4}!$", okResult.Value!.Password);

            userManagerMock.Verify(m => m.CreateAsync(It.IsAny<IdentityUser>(), It.IsAny<string>()), Times.Once);
            roleManagerMock.Verify(m => m.CreateAsync(It.IsAny<IdentityRole>()), Times.Never);

            await using var verifyDb = _fixture.CreateDbContext();
            var pending = await verifyDb.FamilyMemberAccountRequests
                .SingleAsync(r => r.TeamPlayerFamilyMemberId == familyMemberId);
            Assert.Equal(FamilyMemberAccountRequestStatus.Pending, pending.Status);

            var noUserTeam = await verifyDb.UserTeams.AnyAsync(ut => ut.LinkedTeamPlayerId == teamPlayerId && ut.RoleId == Membership.FamilyPlayer.Id);
            Assert.False(noUserTeam);
        }

        [Fact]
        public async Task AliasCollision_AppendsNumericSuffix()
        {
            await using var db = _fixture.CreateDbContext();
            var (_, _, familyMemberId, creatorUserId) = await SeedAsync(db);

            var userManagerMock = MockUserManager();
            userManagerMock.Setup(m => m.FindByNameAsync("janedoe")).ReturnsAsync(new IdentityUser { UserName = "janedoe" });
            userManagerMock.Setup(m => m.FindByNameAsync(It.Is<string>(s => s != "janedoe"))).ReturnsAsync((IdentityUser?)null);
            userManagerMock
                .Setup(m => m.CreateAsync(It.IsAny<IdentityUser>(), It.IsAny<string>()))
                .ReturnsAsync(IdentityResult.Success)
                .Callback<IdentityUser, string>((u, _) => u.Id = $"new-user-{Guid.NewGuid():N}");

            var handler = new RegisterFamilyMemberAccountCommand.Handler(
                userManagerMock.Object, MockRoleManager().Object, db, new ScopeAuthorizationService(db),
                NullLogger<RegisterFamilyMemberAccountCommand.Handler>.Instance);

            var result = await handler.Handle(new RegisterFamilyMemberAccountCommand
            {
                FamilyMemberId = familyMemberId,
                CallerUserId = creatorUserId
            }, CancellationToken.None);

            var okResult = Assert.IsAssignableFrom<IValueHttpResult<RegisterFamilyMemberAccountResponse>>(result);
            Assert.Equal("janedoe2", okResult.Value!.Alias);
        }
    }
}
