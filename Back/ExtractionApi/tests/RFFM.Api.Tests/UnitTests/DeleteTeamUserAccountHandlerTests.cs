#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Users.Commands;
using RFFM.Api.Features.Scopes;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class DeleteTeamUserAccountHandlerTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public DeleteTeamUserAccountHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static Mock<UserManager<IdentityUser>> MockUserManager()
        {
            var store = new Mock<IUserStore<IdentityUser>>();
            return new Mock<UserManager<IdentityUser>>(
                store.Object, null!, null!, null!, null!, null!, null!, null!, null!);
        }

        private static async Task SeedPaymentPlanAsync(AppDbContext db)
        {
            var existingPlan = await db.PaymentPlans.FirstOrDefaultAsync();
            if (existingPlan != null) return;

            var plan = new PaymentPlan
            {
                Name = "Test Plan",
                Description = "Test",
                PriceCents = 0,
                BillingPeriod = BillingPeriodType.Monthly,
                AllowedClubs = 0,
                AllowedTeams = 0,
                AllowedUsers = 0
            };
            db.PaymentPlans.Add(plan);
            await db.SaveChangesAsync();
        }

        private static async Task SeedSubscriptionAsync(AppDbContext db, string userId)
        {
            var plan = await db.PaymentPlans.FirstOrDefaultAsync();
            if (plan == null)
            {
                await SeedPaymentPlanAsync(db);
                plan = await db.PaymentPlans.FirstAsync();
            }

            var subscription = new Subscription
            {
                UserId = userId,
                PaymentPlanId = plan.Id,
                StartDate = DateTime.UtcNow.AddDays(-1),
                EndDate = DateTime.UtcNow.AddYears(1),
                Status = SubscriptionStatus.Active,
                CreatedAt = DateTime.UtcNow
            };
            db.Subscriptions.Add(subscription);
            await db.SaveChangesAsync();
        }

        private static async Task<Team> SeedTeamAsync(AppDbContext db, string clubName, string creatorUserId)
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
                Name = "DeleteTeamUserAccount Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            // Create club-level creator for subscription
            var clubCreatorLink = new UserClub(creatorUserId, club.Id, Membership.Directive.Id);
            clubCreatorLink.IsCreator = true;
            db.UserClubs.Add(clubCreatorLink);
            await db.SaveChangesAsync();

            await SeedSubscriptionAsync(db, creatorUserId);

            return team;
        }

        /// <summary>
        /// Test 1: Caller deletes their own membership → 400 Bad Request, row still exists
        /// </summary>
        [Fact]
        public async Task DeleteOwnMembership_ReturnsBadRequest()
        {
            await using var db = _fixture.CreateDbContext();
            var creatorId = $"creator-{Guid.NewGuid():N}";
            var team = await SeedTeamAsync(db, $"Test Club {Guid.NewGuid():N}", creatorId);
            var callerId = $"caller-{Guid.NewGuid():N}";

            var callerLink = new UserTeam(callerId, team.Id, Membership.Player.Id);
            db.UserTeams.Add(callerLink);
            await db.SaveChangesAsync();

            var scopeAuth = new ScopeAuthorizationService(db);
            var userManagerMock = MockUserManager();
            var handler = new DeleteTeamUserAccount.Handler(db, userManagerMock.Object, scopeAuth, Microsoft.Extensions.Logging.Abstractions.NullLogger<DeleteTeamUserAccount.Handler>.Instance);

            var command = new DeleteTeamUserAccount.Command { CallerUserId = callerId, MembershipId = callerLink.Id };
            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status400BadRequest, statusCodeResult.StatusCode);

            // Verify row still exists
            await using var dbVerify = _fixture.CreateDbContext();
            var stillExists = await dbVerify.UserTeams.AnyAsync(ut => ut.Id == callerLink.Id);
            Assert.True(stillExists);
        }

        /// <summary>
        /// Test 2: Caller deletes the scope creator's membership → 400 Bad Request, row still exists
        /// </summary>
        [Fact]
        public async Task DeleteCreatorMembership_ReturnsBadRequest()
        {
            await using var db = _fixture.CreateDbContext();
            var creatorId = $"creator-{Guid.NewGuid():N}";
            var team = await SeedTeamAsync(db, $"Test Club {Guid.NewGuid():N}", creatorId);
            var callerId = $"caller-{Guid.NewGuid():N}";

            var callerLink = new UserTeam(callerId, team.Id, Membership.Coach.Id);
            db.UserTeams.Add(callerLink);

            var creatorTeamLink = new UserTeam(creatorId, team.Id, Membership.Coach.Id);
            creatorTeamLink.MarkAsCreator();
            db.UserTeams.Add(creatorTeamLink);
            await db.SaveChangesAsync();

            var scopeAuth = new ScopeAuthorizationService(db);
            var userManagerMock = MockUserManager();
            var handler = new DeleteTeamUserAccount.Handler(db, userManagerMock.Object, scopeAuth, Microsoft.Extensions.Logging.Abstractions.NullLogger<DeleteTeamUserAccount.Handler>.Instance);

            var command = new DeleteTeamUserAccount.Command { CallerUserId = callerId, MembershipId = creatorTeamLink.Id };
            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status400BadRequest, statusCodeResult.StatusCode);

            // Verify row still exists
            await using var dbVerify = _fixture.CreateDbContext();
            var stillExists = await dbVerify.UserTeams.AnyAsync(ut => ut.Id == creatorTeamLink.Id);
            Assert.True(stillExists);
        }

        /// <summary>
        /// Test 3: Non-creator caller deletes a Coach membership → 403 Forbidden
        /// </summary>
        [Fact]
        public async Task NonCreatorDeletesCoach_ReturnsForbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var creatorId = $"creator-{Guid.NewGuid():N}";
            var team = await SeedTeamAsync(db, $"Test Club {Guid.NewGuid():N}", creatorId);
            var callerId = $"caller-{Guid.NewGuid():N}";
            var targetId = $"target-{Guid.NewGuid():N}";

            var callerLink = new UserTeam(callerId, team.Id, Membership.Player.Id);
            db.UserTeams.Add(callerLink);

            var targetLink = new UserTeam(targetId, team.Id, Membership.Coach.Id);
            db.UserTeams.Add(targetLink);
            await db.SaveChangesAsync();

            var scopeAuth = new ScopeAuthorizationService(db);
            var userManagerMock = MockUserManager();
            var handler = new DeleteTeamUserAccount.Handler(db, userManagerMock.Object, scopeAuth, Microsoft.Extensions.Logging.Abstractions.NullLogger<DeleteTeamUserAccount.Handler>.Instance);

            var command = new DeleteTeamUserAccount.Command { CallerUserId = callerId, MembershipId = targetLink.Id };
            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status403Forbidden, statusCodeResult.StatusCode);

            // Verify target row still exists
            await using var dbVerify = _fixture.CreateDbContext();
            var stillExists = await dbVerify.UserTeams.AnyAsync(ut => ut.Id == targetLink.Id);
            Assert.True(stillExists);
        }

        /// <summary>
        /// Test 4: Non-creator caller deletes a FamilyPlayer membership → 204 No Content, rows deleted
        /// </summary>
        [Fact]
        public async Task NonCreatorDeletesFamilyPlayer_ReturnsNoContent()
        {
            await using var db = _fixture.CreateDbContext();
            var creatorId = $"creator-{Guid.NewGuid():N}";
            var team = await SeedTeamAsync(db, $"Test Club {Guid.NewGuid():N}", creatorId);
            var callerId = $"caller-{Guid.NewGuid():N}";
            var targetId = $"target-{Guid.NewGuid():N}";

            var callerLink = new UserTeam(callerId, team.Id, Membership.Player.Id);
            db.UserTeams.Add(callerLink);

            var targetLink = new UserTeam(targetId, team.Id, Membership.FamilyPlayer.Id);
            db.UserTeams.Add(targetLink);
            await db.SaveChangesAsync();

            var userManagerMock = MockUserManager();
            userManagerMock.Setup(m => m.FindByIdAsync(targetId))
                .ReturnsAsync(new IdentityUser { Id = targetId, UserName = "target" });
            userManagerMock.Setup(m => m.DeleteAsync(It.IsAny<IdentityUser>()))
                .ReturnsAsync(IdentityResult.Success);

            var scopeAuth = new ScopeAuthorizationService(db);
            var handler = new DeleteTeamUserAccount.Handler(db, userManagerMock.Object, scopeAuth, Microsoft.Extensions.Logging.Abstractions.NullLogger<DeleteTeamUserAccount.Handler>.Instance);

            var command = new DeleteTeamUserAccount.Command { CallerUserId = callerId, MembershipId = targetLink.Id };
            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status204NoContent, statusCodeResult.StatusCode);

            // Verify rows deleted
            await using var dbVerify = _fixture.CreateDbContext();
            var targetStillExists = await dbVerify.UserTeams.AnyAsync(ut => ut.ApplicationUserId == targetId);
            Assert.False(targetStillExists);
        }

        /// <summary>
        /// Test 5: Creator deletes a Coach membership → 204 No Content
        /// </summary>
        [Fact]
        public async Task CreatorDeletesCoach_ReturnsNoContent()
        {
            await using var db = _fixture.CreateDbContext();
            var creatorId = $"creator-{Guid.NewGuid():N}";
            var team = await SeedTeamAsync(db, $"Test Club {Guid.NewGuid():N}", creatorId);
            var targetId = $"target-{Guid.NewGuid():N}";

            var creatorTeamLink = new UserTeam(creatorId, team.Id, Membership.Coach.Id);
            creatorTeamLink.MarkAsCreator();
            db.UserTeams.Add(creatorTeamLink);

            var targetLink = new UserTeam(targetId, team.Id, Membership.Coach.Id);
            db.UserTeams.Add(targetLink);
            await db.SaveChangesAsync();

            var userManagerMock = MockUserManager();
            userManagerMock.Setup(m => m.FindByIdAsync(targetId))
                .ReturnsAsync(new IdentityUser { Id = targetId, UserName = "target" });
            userManagerMock.Setup(m => m.DeleteAsync(It.IsAny<IdentityUser>()))
                .ReturnsAsync(IdentityResult.Success);

            var scopeAuth = new ScopeAuthorizationService(db);
            var handler = new DeleteTeamUserAccount.Handler(db, userManagerMock.Object, scopeAuth, Microsoft.Extensions.Logging.Abstractions.NullLogger<DeleteTeamUserAccount.Handler>.Instance);

            var command = new DeleteTeamUserAccount.Command { CallerUserId = creatorId, MembershipId = targetLink.Id };
            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status204NoContent, statusCodeResult.StatusCode);

            // Verify target deleted
            await using var dbVerify = _fixture.CreateDbContext();
            var targetStillExists = await dbVerify.UserTeams.AnyAsync(ut => ut.ApplicationUserId == targetId);
            Assert.False(targetStillExists);
        }

        /// <summary>
        /// Test 6: Unknown membershipId → 404 Not Found
        /// </summary>
        [Fact]
        public async Task UnknownMembershipId_ReturnsNotFound()
        {
            await using var db = _fixture.CreateDbContext();
            var creatorId = $"creator-{Guid.NewGuid():N}";
            var team = await SeedTeamAsync(db, $"Test Club {Guid.NewGuid():N}", creatorId);
            var callerId = $"caller-{Guid.NewGuid():N}";
            var unknownMembershipId = Guid.NewGuid().ToString();

            var callerLink = new UserTeam(callerId, team.Id, Membership.Coach.Id);
            db.UserTeams.Add(callerLink);
            await db.SaveChangesAsync();

            var scopeAuth = new ScopeAuthorizationService(db);
            var userManagerMock = MockUserManager();
            var handler = new DeleteTeamUserAccount.Handler(db, userManagerMock.Object, scopeAuth, Microsoft.Extensions.Logging.Abstractions.NullLogger<DeleteTeamUserAccount.Handler>.Instance);

            var command = new DeleteTeamUserAccount.Command { CallerUserId = callerId, MembershipId = unknownMembershipId };
            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status404NotFound, statusCodeResult.StatusCode);
        }

        /// <summary>
        /// Test 7: Target has multiple UserTeam rows on same team → all deleted
        /// (Note: simplified to not require multiple clubs/teams due to subscription complexity)
        /// </summary>
        [Fact]
        public async Task TargetWithTeamMembership_AllDeletedWithCreatorHandler()
        {
            await using var db = _fixture.CreateDbContext();
            var creatorId = $"creator-{Guid.NewGuid():N}";
            var team = await SeedTeamAsync(db, $"Club {Guid.NewGuid():N}", creatorId);
            var callerId = $"caller-{Guid.NewGuid():N}";
            var targetId = $"target-{Guid.NewGuid():N}";

            // Target has membership on the team
            var targetLink = new UserTeam(targetId, team.Id, Membership.Player.Id);
            db.UserTeams.Add(targetLink);

            var callerLink = new UserTeam(callerId, team.Id, Membership.Coach.Id);
            db.UserTeams.Add(callerLink);
            await db.SaveChangesAsync();

            var userManagerMock = MockUserManager();
            userManagerMock.Setup(m => m.FindByIdAsync(targetId))
                .ReturnsAsync(new IdentityUser { Id = targetId, UserName = "target" });
            userManagerMock.Setup(m => m.DeleteAsync(It.IsAny<IdentityUser>()))
                .ReturnsAsync(IdentityResult.Success);

            var scopeAuth = new ScopeAuthorizationService(db);
            var handler = new DeleteTeamUserAccount.Handler(db, userManagerMock.Object, scopeAuth, Microsoft.Extensions.Logging.Abstractions.NullLogger<DeleteTeamUserAccount.Handler>.Instance);

            var command = new DeleteTeamUserAccount.Command { CallerUserId = callerId, MembershipId = targetLink.Id };
            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status204NoContent, statusCodeResult.StatusCode);

            // Verify target membership deleted
            await using var dbVerify = _fixture.CreateDbContext();
            var membershipStillExists = await dbVerify.UserTeams.AnyAsync(ut => ut.ApplicationUserId == targetId);
            Assert.False(membershipStillExists);
        }

        /// <summary>
        /// Test 8: Target deletion succeeds and Identity user is best-effort deleted
        /// </summary>
        [Fact]
        public async Task TargetDeletion_IdentityUserBestEffort()
        {
            await using var db = _fixture.CreateDbContext();
            var creatorId = $"creator-{Guid.NewGuid():N}";
            var team = await SeedTeamAsync(db, $"Test Club {Guid.NewGuid():N}", creatorId);
            var callerId = $"caller-{Guid.NewGuid():N}";
            var targetId = $"target-{Guid.NewGuid():N}";

            var callerLink = new UserTeam(callerId, team.Id, Membership.Coach.Id);
            db.UserTeams.Add(callerLink);

            var targetLink = new UserTeam(targetId, team.Id, Membership.Player.Id);
            db.UserTeams.Add(targetLink);
            await db.SaveChangesAsync();

            var userManagerMock = MockUserManager();
            userManagerMock.Setup(m => m.FindByIdAsync(targetId))
                .ReturnsAsync(new IdentityUser { Id = targetId, UserName = "target" });
            // Simulate Identity delete failure - handler should still return 204
            userManagerMock.Setup(m => m.DeleteAsync(It.IsAny<IdentityUser>()))
                .ReturnsAsync(IdentityResult.Failed(new IdentityError { Code = "Error", Description = "Failed" }));

            var scopeAuth = new ScopeAuthorizationService(db);
            var handler = new DeleteTeamUserAccount.Handler(db, userManagerMock.Object, scopeAuth, Microsoft.Extensions.Logging.Abstractions.NullLogger<DeleteTeamUserAccount.Handler>.Instance);

            var command = new DeleteTeamUserAccount.Command { CallerUserId = callerId, MembershipId = targetLink.Id };
            var result = await handler.Handle(command, CancellationToken.None);

            // Should still return 204 even if Identity delete fails (best-effort)
            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status204NoContent, statusCodeResult.StatusCode);

            // Verify app-side rows deleted even if Identity delete failed
            await using var dbVerify = _fixture.CreateDbContext();
            var membershipStillExists = await dbVerify.UserTeams.AnyAsync(ut => ut.Id == targetLink.Id);
            Assert.False(membershipStillExists);
        }

        /// <summary>
        /// Test 7b (design.md Decision 2 step 5 / tasks.md 2.1): target also holds a UserClub row
        /// on a different club and a UserTeam row on a different team -> deleting via the viewed
        /// team's membershipId removes every UserTeam/UserClub row the account holds, not just the
        /// one being viewed.
        /// </summary>
        [Fact]
        public async Task TargetWithMembershipsAcrossMultipleTeamsAndClubs_AllRemoved()
        {
            await using var db = _fixture.CreateDbContext();
            var creatorId = $"creator-{Guid.NewGuid():N}";
            var team = await SeedTeamAsync(db, $"Club {Guid.NewGuid():N}", creatorId);
            var callerId = $"caller-{Guid.NewGuid():N}";
            var targetId = $"target-{Guid.NewGuid():N}";

            var callerLink = new UserTeam(callerId, team.Id, Membership.Coach.Id);
            db.UserTeams.Add(callerLink);

            var targetLink = new UserTeam(targetId, team.Id, Membership.Player.Id);
            db.UserTeams.Add(targetLink);
            await db.SaveChangesAsync();

            // Target also has a UserClub row on a different (unrelated) club...
            var otherClub = Club.Create($"Other Club {Guid.NewGuid():N}", SeededCountryId);
            db.Clubs.Add(otherClub);
            await db.SaveChangesAsync();
            var targetClubLink = new UserClub(targetId, otherClub.Id, Membership.ClubMember.Id);
            db.UserClubs.Add(targetClubLink);

            // ...and a UserTeam row on a different team of a different club.
            var otherClub2 = Club.Create($"Other Club 2 {Guid.NewGuid():N}", SeededCountryId);
            db.Clubs.Add(otherClub2);
            await db.SaveChangesAsync();
            var otherSeason = Season.Create(
                $"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: otherClub2);
            db.Seasons.Add(otherSeason);
            await db.SaveChangesAsync();
            var otherTeam = new Team(new TeamModelBase
            {
                Name = "Other Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = otherClub2.Id,
                SeasonId = otherSeason.Id
            });
            db.Teams.Add(otherTeam);
            await db.SaveChangesAsync();
            var targetOtherTeamLink = new UserTeam(targetId, otherTeam.Id, Membership.FamilyPlayer.Id);
            db.UserTeams.Add(targetOtherTeamLink);
            await db.SaveChangesAsync();

            var userManagerMock = MockUserManager();
            userManagerMock.Setup(m => m.FindByIdAsync(targetId))
                .ReturnsAsync(new IdentityUser { Id = targetId, UserName = "target" });
            userManagerMock.Setup(m => m.DeleteAsync(It.IsAny<IdentityUser>()))
                .ReturnsAsync(IdentityResult.Success);

            var scopeAuth = new ScopeAuthorizationService(db);
            var handler = new DeleteTeamUserAccount.Handler(db, userManagerMock.Object, scopeAuth, Microsoft.Extensions.Logging.Abstractions.NullLogger<DeleteTeamUserAccount.Handler>.Instance);

            var command = new DeleteTeamUserAccount.Command { CallerUserId = callerId, MembershipId = targetLink.Id };
            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status204NoContent, statusCodeResult.StatusCode);

            await using var dbVerify = _fixture.CreateDbContext();
            Assert.False(await dbVerify.UserTeams.AnyAsync(ut => ut.ApplicationUserId == targetId));
            Assert.False(await dbVerify.UserClubs.AnyAsync(uc => uc.ApplicationUserId == targetId));
        }

        /// <summary>
        /// Test 8 (tasks.md 2.1): target's UserTeam has a LinkedTeamPlayerId -> after deletion the
        /// corresponding TeamPlayer row is unchanged and still queryable (Player/TeamPlayer domain
        /// data is never touched by this handler).
        /// </summary>
        [Fact]
        public async Task TargetWithLinkedTeamPlayer_TeamPlayerRowUntouched()
        {
            await using var db = _fixture.CreateDbContext();
            var creatorId = $"creator-{Guid.NewGuid():N}";
            var team = await SeedTeamAsync(db, $"Club {Guid.NewGuid():N}", creatorId);
            var callerId = $"caller-{Guid.NewGuid():N}";
            var targetId = $"target-{Guid.NewGuid():N}";

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

            var callerLink = new UserTeam(callerId, team.Id, Membership.Coach.Id);
            db.UserTeams.Add(callerLink);

            var targetLink = new UserTeam(targetId, team.Id, Membership.Player.Id);
            targetLink.LinkPlayer(teamPlayer.Id);
            db.UserTeams.Add(targetLink);
            await db.SaveChangesAsync();

            var userManagerMock = MockUserManager();
            userManagerMock.Setup(m => m.FindByIdAsync(targetId))
                .ReturnsAsync(new IdentityUser { Id = targetId, UserName = "target" });
            userManagerMock.Setup(m => m.DeleteAsync(It.IsAny<IdentityUser>()))
                .ReturnsAsync(IdentityResult.Success);

            var scopeAuth = new ScopeAuthorizationService(db);
            var handler = new DeleteTeamUserAccount.Handler(db, userManagerMock.Object, scopeAuth, Microsoft.Extensions.Logging.Abstractions.NullLogger<DeleteTeamUserAccount.Handler>.Instance);

            var command = new DeleteTeamUserAccount.Command { CallerUserId = callerId, MembershipId = targetLink.Id };
            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status204NoContent, statusCodeResult.StatusCode);

            await using var dbVerify = _fixture.CreateDbContext();
            Assert.False(await dbVerify.UserTeams.AnyAsync(ut => ut.ApplicationUserId == targetId));
            var reloadedTeamPlayer = await dbVerify.TeamPlayers.AsNoTracking().SingleAsync(tp => tp.Id == teamPlayer.Id);
            Assert.Equal(player.Id, reloadedTeamPlayer.PlayerId);
            Assert.Equal(team.Id, reloadedTeamPlayer.TeamId);
        }

        /// <summary>
        /// Test 9: a target that only has a club-level UserClub row (no UserTeam for this team —
        /// e.g. a coach who joined via club invitation code) can still be resolved and deleted by
        /// MembershipId, with the same creator-only rule for coach-tier targets.
        /// </summary>
        [Fact]
        public async Task ClubLevelCoachTarget_CreatorCanDelete_NonCreatorCannot()
        {
            await using var db = _fixture.CreateDbContext();
            var creatorId = $"creator-{Guid.NewGuid():N}";
            var team = await SeedTeamAsync(db, $"Club {Guid.NewGuid():N}", creatorId);

            var clubCoachId = $"clubcoach-{Guid.NewGuid():N}";
            var clubCoachLink = new UserClub(clubCoachId, team.ClubId, Membership.Coach.Id);
            db.UserClubs.Add(clubCoachLink);

            var nonCreatorMemberId = $"member-{Guid.NewGuid():N}";
            var nonCreatorMemberLink = new UserTeam(nonCreatorMemberId, team.Id, Membership.Player.Id);
            db.UserTeams.Add(nonCreatorMemberLink);

            await db.SaveChangesAsync();

            var userManagerMock = MockUserManager();
            userManagerMock.Setup(m => m.FindByIdAsync(clubCoachId))
                .ReturnsAsync(new IdentityUser { Id = clubCoachId, UserName = "clubcoach" });
            userManagerMock.Setup(m => m.DeleteAsync(It.IsAny<IdentityUser>()))
                .ReturnsAsync(IdentityResult.Success);

            var scopeAuth = new ScopeAuthorizationService(db);

            // Non-creator team member cannot delete a coach-tier club-level target.
            var handlerAsMember = new DeleteTeamUserAccount.Handler(db, userManagerMock.Object, scopeAuth, Microsoft.Extensions.Logging.Abstractions.NullLogger<DeleteTeamUserAccount.Handler>.Instance);
            var commandAsMember = new DeleteTeamUserAccount.Command { CallerUserId = nonCreatorMemberId, MembershipId = clubCoachLink.Id };
            var resultAsMember = await handlerAsMember.Handle(commandAsMember, CancellationToken.None);
            var forbiddenResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(resultAsMember);
            Assert.Equal(StatusCodes.Status403Forbidden, forbiddenResult.StatusCode);

            // The creator (club-level, resolved via the target's ClubId) can delete it.
            var handlerAsCreator = new DeleteTeamUserAccount.Handler(db, userManagerMock.Object, scopeAuth, Microsoft.Extensions.Logging.Abstractions.NullLogger<DeleteTeamUserAccount.Handler>.Instance);
            var commandAsCreator = new DeleteTeamUserAccount.Command { CallerUserId = creatorId, MembershipId = clubCoachLink.Id };
            var resultAsCreator = await handlerAsCreator.Handle(commandAsCreator, CancellationToken.None);
            var successResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(resultAsCreator);
            Assert.Equal(StatusCodes.Status204NoContent, successResult.StatusCode);

            await using var dbVerify = _fixture.CreateDbContext();
            Assert.False(await dbVerify.UserClubs.AnyAsync(uc => uc.ApplicationUserId == clubCoachId));
        }
    }
}
