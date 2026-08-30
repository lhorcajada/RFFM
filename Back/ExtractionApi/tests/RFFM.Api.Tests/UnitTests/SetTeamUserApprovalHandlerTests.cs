#nullable enable
using System;
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
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Users.Commands;
using RFFM.Api.Features.Scopes;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class SetTeamUserApprovalHandlerTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public SetTeamUserApprovalHandlerTests(PostgresContainerFixture fixture)
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
                Name = "SetTeamUserApproval Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var clubCreatorLink = new UserClub(creatorUserId, club.Id, Membership.Directive.Id);
            clubCreatorLink.IsCreator = true;
            db.UserClubs.Add(clubCreatorLink);
            await db.SaveChangesAsync();

            await SeedSubscriptionAsync(db, creatorUserId);

            return team;
        }

        [Fact]
        public async Task UnknownMembershipId_ReturnsNotFound()
        {
            await using var db = _fixture.CreateDbContext();
            var creatorId = $"creator-{Guid.NewGuid():N}";
            await SeedTeamAsync(db, $"Club {Guid.NewGuid():N}", creatorId);

            var scopeAuth = new ScopeAuthorizationService(db);
            var handler = new SetTeamUserApproval.Handler(db, MockUserManager().Object, scopeAuth);
            var command = new SetTeamUserApproval.Command { CallerUserId = creatorId, MembershipId = Guid.NewGuid().ToString(), Approved = true };

            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status404NotFound, statusCodeResult.StatusCode);
        }

        [Fact]
        public async Task SelfTarget_ReturnsBadRequest()
        {
            await using var db = _fixture.CreateDbContext();
            var creatorId = $"creator-{Guid.NewGuid():N}";
            var team = await SeedTeamAsync(db, $"Club {Guid.NewGuid():N}", creatorId);

            var callerLink = new UserTeam(creatorId, team.Id, Membership.Coach.Id);
            db.UserTeams.Add(callerLink);
            await db.SaveChangesAsync();

            var scopeAuth = new ScopeAuthorizationService(db);
            var handler = new SetTeamUserApproval.Handler(db, MockUserManager().Object, scopeAuth);
            var command = new SetTeamUserApproval.Command { CallerUserId = creatorId, MembershipId = callerLink.Id, Approved = false };

            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status400BadRequest, statusCodeResult.StatusCode);
        }

        [Fact]
        public async Task NonCreatorCaller_TogglingCoachTarget_ReturnsForbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var creatorId = $"creator-{Guid.NewGuid():N}";
            var team = await SeedTeamAsync(db, $"Club {Guid.NewGuid():N}", creatorId);

            var callerId = $"caller-{Guid.NewGuid():N}";
            db.UserTeams.Add(new UserTeam(callerId, team.Id, Membership.Player.Id));

            var coachTargetId = $"coach-{Guid.NewGuid():N}";
            var coachTargetLink = new UserTeam(coachTargetId, team.Id, Membership.Coach.Id);
            db.UserTeams.Add(coachTargetLink);
            await db.SaveChangesAsync();

            var scopeAuth = new ScopeAuthorizationService(db);
            var handler = new SetTeamUserApproval.Handler(db, MockUserManager().Object, scopeAuth);
            var command = new SetTeamUserApproval.Command { CallerUserId = callerId, MembershipId = coachTargetLink.Id, Approved = true };

            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status403Forbidden, statusCodeResult.StatusCode);
        }

        [Fact]
        public async Task NonCreatorCaller_TogglingFamilyPlayerTarget_Succeeds()
        {
            await using var db = _fixture.CreateDbContext();
            var creatorId = $"creator-{Guid.NewGuid():N}";
            var team = await SeedTeamAsync(db, $"Club {Guid.NewGuid():N}", creatorId);

            var callerId = $"caller-{Guid.NewGuid():N}";
            db.UserTeams.Add(new UserTeam(callerId, team.Id, Membership.Coach.Id));

            var familyId = $"family-{Guid.NewGuid():N}";
            var familyLink = new UserTeam(familyId, team.Id, Membership.FamilyPlayer.Id);
            db.UserTeams.Add(familyLink);
            await db.SaveChangesAsync();

            var identityUser = new IdentityUser { Id = familyId, UserName = "family", EmailConfirmed = false };
            var userManagerMock = MockUserManager();
            userManagerMock.Setup(m => m.FindByIdAsync(familyId)).ReturnsAsync(identityUser);
            userManagerMock.Setup(m => m.UpdateAsync(It.IsAny<IdentityUser>())).ReturnsAsync(IdentityResult.Success);

            var scopeAuth = new ScopeAuthorizationService(db);
            var handler = new SetTeamUserApproval.Handler(db, userManagerMock.Object, scopeAuth);
            var command = new SetTeamUserApproval.Command { CallerUserId = callerId, MembershipId = familyLink.Id, Approved = true };

            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status204NoContent, statusCodeResult.StatusCode);
            Assert.True(identityUser.EmailConfirmed);
            userManagerMock.Verify(m => m.UpdateAsync(It.Is<IdentityUser>(u => u.Id == familyId && u.EmailConfirmed)), Times.Once);
        }

        [Fact]
        public async Task Creator_CanRevokeApprovalOfCoachTarget()
        {
            await using var db = _fixture.CreateDbContext();
            var creatorId = $"creator-{Guid.NewGuid():N}";
            var team = await SeedTeamAsync(db, $"Club {Guid.NewGuid():N}", creatorId);

            var coachTargetId = $"coach-{Guid.NewGuid():N}";
            var coachTargetLink = new UserTeam(coachTargetId, team.Id, Membership.Coach.Id);
            db.UserTeams.Add(coachTargetLink);
            await db.SaveChangesAsync();

            var identityUser = new IdentityUser { Id = coachTargetId, UserName = "coach", EmailConfirmed = true };
            var userManagerMock = MockUserManager();
            userManagerMock.Setup(m => m.FindByIdAsync(coachTargetId)).ReturnsAsync(identityUser);
            userManagerMock.Setup(m => m.UpdateAsync(It.IsAny<IdentityUser>())).ReturnsAsync(IdentityResult.Success);

            var scopeAuth = new ScopeAuthorizationService(db);
            var handler = new SetTeamUserApproval.Handler(db, userManagerMock.Object, scopeAuth);
            var command = new SetTeamUserApproval.Command { CallerUserId = creatorId, MembershipId = coachTargetLink.Id, Approved = false };

            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status204NoContent, statusCodeResult.StatusCode);
            Assert.False(identityUser.EmailConfirmed);
        }

        [Fact]
        public async Task ClubLevelTarget_CanBeToggled()
        {
            await using var db = _fixture.CreateDbContext();
            var creatorId = $"creator-{Guid.NewGuid():N}";
            var team = await SeedTeamAsync(db, $"Club {Guid.NewGuid():N}", creatorId);

            var clubCoachId = $"clubcoach-{Guid.NewGuid():N}";
            var clubCoachLink = new UserClub(clubCoachId, team.ClubId, Membership.Coach.Id);
            db.UserClubs.Add(clubCoachLink);
            await db.SaveChangesAsync();

            var identityUser = new IdentityUser { Id = clubCoachId, UserName = "clubcoach", EmailConfirmed = false };
            var userManagerMock = MockUserManager();
            userManagerMock.Setup(m => m.FindByIdAsync(clubCoachId)).ReturnsAsync(identityUser);
            userManagerMock.Setup(m => m.UpdateAsync(It.IsAny<IdentityUser>())).ReturnsAsync(IdentityResult.Success);

            var scopeAuth = new ScopeAuthorizationService(db);
            var handler = new SetTeamUserApproval.Handler(db, userManagerMock.Object, scopeAuth);
            var command = new SetTeamUserApproval.Command { CallerUserId = creatorId, MembershipId = clubCoachLink.Id, Approved = true };

            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status204NoContent, statusCodeResult.StatusCode);
            Assert.True(identityUser.EmailConfirmed);
        }
    }
}
