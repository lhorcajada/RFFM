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
using RFFM.Api.Domain.Entities;
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
    public class ApproveFamilyMemberAccountHandlerTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public ApproveFamilyMemberAccountHandlerTests(PostgresContainerFixture fixture)
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

        private static async Task<(Team Team, string TeamPlayerId, string FamilyMemberId, string CreatorUserId, string LinkedUserId, string RequestId)> SeedPendingRequestAsync(AppDbContext db)
        {
            var club = Club.Create($"FamilyAccounts Approve Club {Guid.NewGuid():N}", SeededCountryId);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9),
                isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "FamilyAccounts Approve Test Team",
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
                teamPlayer.Id, "Jane", "Doe", "600123456", "jane@rffm.test", "12345678A", "Mother");
            db.TeamPlayerFamilyMembers.Add(familyMember);
            await db.SaveChangesAsync();

            var creatorUserId = $"creator-{Guid.NewGuid():N}";
            var creatorLink = new UserTeam(creatorUserId, team.Id, Membership.Coach.Id);
            creatorLink.MarkAsCreator();
            db.UserTeams.Add(creatorLink);
            await db.SaveChangesAsync();

            var linkedUserId = $"linked-{Guid.NewGuid():N}";
            var request = FamilyMemberAccountRequest.Create(linkedUserId, familyMember.Id, teamPlayer.Id);
            db.FamilyMemberAccountRequests.Add(request);
            await db.SaveChangesAsync();

            return (team, teamPlayer.Id, familyMember.Id, creatorUserId, linkedUserId, request.Id);
        }

        private static ApproveFamilyMemberAccountHandler BuildHandler(
            AppDbContext db, out Mock<UserManager<IdentityUser>> userManagerMock, out Mock<RoleManager<IdentityRole>> roleManagerMock)
        {
            userManagerMock = MockUserManager();
            roleManagerMock = MockRoleManager();
            roleManagerMock.Setup(m => m.RoleExistsAsync(It.IsAny<string>())).ReturnsAsync(true);
            return new ApproveFamilyMemberAccountHandler(
                db, new ScopeAuthorizationService(db), userManagerMock.Object, roleManagerMock.Object,
                NullLogger<ApproveFamilyMemberAccountHandler>.Instance);
        }

        [Fact]
        public async Task RequestNotFound_ReturnsNotFound()
        {
            await using var db = _fixture.CreateDbContext();
            var handler = BuildHandler(db, out _, out _);

            var result = await handler.Handle(new ApproveFamilyMemberAccountCommand
            {
                RequestId = "does-not-exist",
                CallerUserId = $"caller-{Guid.NewGuid():N}"
            }, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status404NotFound, statusCodeResult.StatusCode);
        }

        [Fact]
        public async Task UnauthorizedCaller_ReturnsForbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var seed = await SeedPendingRequestAsync(db);
            var handler = BuildHandler(db, out _, out _);

            var result = await handler.Handle(new ApproveFamilyMemberAccountCommand
            {
                RequestId = seed.RequestId,
                CallerUserId = $"outsider-{Guid.NewGuid():N}"
            }, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status403Forbidden, statusCodeResult.StatusCode);
        }

        [Fact]
        public async Task AlreadyDecidedRequest_ReturnsConflict()
        {
            await using var db = _fixture.CreateDbContext();
            var seed = await SeedPendingRequestAsync(db);

            var request = await db.FamilyMemberAccountRequests.FirstAsync(r => r.Id == seed.RequestId);
            request.Approve(seed.CreatorUserId);
            await db.SaveChangesAsync();

            var handler = BuildHandler(db, out _, out _);

            var result = await handler.Handle(new ApproveFamilyMemberAccountCommand
            {
                RequestId = seed.RequestId,
                CallerUserId = seed.CreatorUserId
            }, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status409Conflict, statusCodeResult.StatusCode);
        }

        [Fact]
        public async Task HappyPath_AssignsRoleCreatesUserTeamAndLinksAccount()
        {
            await using var db = _fixture.CreateDbContext();
            var seed = await SeedPendingRequestAsync(db);

            var handler = BuildHandler(db, out var userManagerMock, out var roleManagerMock);
            var identityUser = new IdentityUser { Id = seed.LinkedUserId, UserName = "janedoe", EmailConfirmed = false };
            userManagerMock
                .Setup(m => m.FindByIdAsync(seed.LinkedUserId))
                .ReturnsAsync(identityUser);
            userManagerMock
                .Setup(m => m.IsInRoleAsync(It.IsAny<IdentityUser>(), It.IsAny<string>()))
                .ReturnsAsync(false);
            userManagerMock
                .Setup(m => m.UpdateAsync(It.IsAny<IdentityUser>()))
                .ReturnsAsync(IdentityResult.Success);

            var result = await handler.Handle(new ApproveFamilyMemberAccountCommand
            {
                RequestId = seed.RequestId,
                CallerUserId = seed.CreatorUserId
            }, CancellationToken.None);

            Assert.IsAssignableFrom<Ok>(result);

            userManagerMock.Verify(m => m.AddToRoleAsync(It.IsAny<IdentityUser>(), AppRoles.FamilyMember.Name), Times.Once);

            // Regression: approving must unlock login by confirming the linked IdentityUser's email,
            // mirroring SetTeamUserApproval.cs. Without this, login keeps rejecting the approved account.
            Assert.True(identityUser.EmailConfirmed);
            userManagerMock.Verify(m => m.UpdateAsync(It.Is<IdentityUser>(u => u.Id == seed.LinkedUserId && u.EmailConfirmed)), Times.Once);

            await using var verifyDb = _fixture.CreateDbContext();
            var storedRequest = await verifyDb.FamilyMemberAccountRequests.SingleAsync(r => r.Id == seed.RequestId);
            Assert.Equal(FamilyMemberAccountRequestStatus.Approved, storedRequest.Status);

            var userTeam = await verifyDb.UserTeams.SingleAsync(ut =>
                ut.ApplicationUserId == seed.LinkedUserId && ut.TeamId == seed.Team.Id);
            Assert.Equal(Membership.FamilyPlayer.Id, userTeam.RoleId);
            Assert.Equal(seed.TeamPlayerId, userTeam.LinkedTeamPlayerId);

            var profile = await verifyDb.UserProfiles.SingleAsync(p => p.ApplicationUserId == seed.LinkedUserId);
            Assert.Equal(seed.TeamPlayerId, profile.PlayerId);
            Assert.Equal(seed.Team.Id, profile.TeamId);

            var familyMember = await verifyDb.TeamPlayerFamilyMembers.SingleAsync(f => f.Id == seed.FamilyMemberId);
            Assert.Equal(seed.LinkedUserId, familyMember.LinkedUserId);
        }
    }
}
