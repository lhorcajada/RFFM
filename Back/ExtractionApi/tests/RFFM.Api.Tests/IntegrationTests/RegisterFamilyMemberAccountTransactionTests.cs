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

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// End-to-end coverage for the full Register -> Approve happy path (openspec change
    /// family-member-coach-registration), against the real Testcontainers Postgres instance,
    /// asserting the final state left by both commands together: UserTeam, UserProfile,
    /// Identity role assignment, and TeamPlayerFamilyMember.LinkedUserId.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class RegisterFamilyMemberAccountTransactionTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public RegisterFamilyMemberAccountTransactionTests(PostgresContainerFixture fixture)
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

        [Fact]
        public async Task RegisterThenApprove_LeavesConsistentEndToEndState()
        {
            await using var db = _fixture.CreateDbContext();

            var club = Club.Create($"E2E FamilyAccounts Club {Guid.NewGuid():N}", SeededCountryId);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9),
                isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "E2E FamilyAccounts Team",
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

            // -- Register --
            var registerUserManagerMock = MockUserManager();
            registerUserManagerMock.Setup(m => m.FindByNameAsync(It.IsAny<string>())).ReturnsAsync((IdentityUser?)null);
            string? createdUserId = null;
            registerUserManagerMock
                .Setup(m => m.CreateAsync(It.IsAny<IdentityUser>(), It.IsAny<string>()))
                .ReturnsAsync(IdentityResult.Success)
                .Callback<IdentityUser, string>((u, _) =>
                {
                    u.Id = $"new-user-{Guid.NewGuid():N}";
                    createdUserId = u.Id;
                });

            var registerHandler = new RegisterFamilyMemberAccountCommand.Handler(
                registerUserManagerMock.Object, MockRoleManager().Object, db, new ScopeAuthorizationService(db),
                NullLogger<RegisterFamilyMemberAccountCommand.Handler>.Instance);

            var registerResult = await registerHandler.Handle(new RegisterFamilyMemberAccountCommand
            {
                FamilyMemberId = familyMember.Id,
                CallerUserId = creatorUserId
            }, CancellationToken.None);

            var registerOk = Assert.IsAssignableFrom<IValueHttpResult<RegisterFamilyMemberAccountResponse>>(registerResult);
            var requestId = registerOk.Value!.RequestId;
            Assert.False(string.IsNullOrWhiteSpace(requestId));
            Assert.NotNull(createdUserId);

            // -- Approve --
            await using var approveDb = _fixture.CreateDbContext();
            var approveUserManagerMock = MockUserManager();
            approveUserManagerMock
                .Setup(m => m.FindByIdAsync(createdUserId!))
                .ReturnsAsync(new IdentityUser { Id = createdUserId!, UserName = "janedoe" });
            approveUserManagerMock
                .Setup(m => m.IsInRoleAsync(It.IsAny<IdentityUser>(), It.IsAny<string>()))
                .ReturnsAsync(false);
            var approveRoleManagerMock = MockRoleManager();
            approveRoleManagerMock.Setup(m => m.RoleExistsAsync(It.IsAny<string>())).ReturnsAsync(true);

            var approveHandler = new ApproveFamilyMemberAccountHandler(
                approveDb, new ScopeAuthorizationService(approveDb), approveUserManagerMock.Object, approveRoleManagerMock.Object,
                NullLogger<ApproveFamilyMemberAccountHandler>.Instance);

            var approveResult = await approveHandler.Handle(new ApproveFamilyMemberAccountCommand
            {
                RequestId = requestId,
                CallerUserId = creatorUserId
            }, CancellationToken.None);

            Assert.IsAssignableFrom<Ok>(approveResult);

            approveUserManagerMock.Verify(m => m.AddToRoleAsync(It.IsAny<IdentityUser>(), AppRoles.FamilyMember.Name), Times.Once);

            await using var verifyDb = _fixture.CreateDbContext();

            var storedRequest = await verifyDb.FamilyMemberAccountRequests.SingleAsync(r => r.Id == requestId);
            Assert.Equal(FamilyMemberAccountRequestStatus.Approved, storedRequest.Status);

            var userTeam = await verifyDb.UserTeams.SingleAsync(ut =>
                ut.ApplicationUserId == createdUserId && ut.TeamId == team.Id);
            Assert.Equal(Membership.FamilyPlayer.Id, userTeam.RoleId);
            Assert.Equal(teamPlayer.Id, userTeam.LinkedTeamPlayerId);

            var profile = await verifyDb.UserProfiles.SingleAsync(p => p.ApplicationUserId == createdUserId);
            Assert.Equal(teamPlayer.Id, profile.PlayerId);
            Assert.Equal(team.Id, profile.TeamId);

            var storedFamilyMember = await verifyDb.TeamPlayerFamilyMembers.SingleAsync(f => f.Id == familyMember.Id);
            Assert.Equal(createdUserId, storedFamilyMember.LinkedUserId);
        }
    }
}
