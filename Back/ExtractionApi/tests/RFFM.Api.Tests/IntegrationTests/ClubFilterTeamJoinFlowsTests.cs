#nullable enable
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.ClubJoinRequests.Commands;
using RFFM.Api.Features.Coaches.Invitation;
using RFFM.Api.Features.Coaches.Invitation.Commands;
using RFFM.Api.Features.Coaches.Teams.Queries;
using RFFM.Api.Features.Scopes;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Guard tests for the team join-code flows that read Team before the caller is a member. They
    /// pass today and must stay green after the Team filter is registered (Step 4). Each flow runs
    /// with the real handler and the same collaborator doubles as its sibling unit tests.
    /// The join-request approve and reject handlers are creator-only, so they run with the club
    /// creator as caller; the applicant is the non-member with a pending request.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class ClubFilterTeamJoinFlowsTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public ClubFilterTeamJoinFlowsTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static Mock<ICurrentUserService> CurrentUser(string userId)
        {
            var mock = new Mock<ICurrentUserService>();
            mock.Setup(c => c.UserId).Returns(userId);
            mock.Setup(c => c.IsAuthenticated).Returns(true);
            return mock;
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

        private static Mock<UserManager<IdentityUser>> DefaultUserManager(string userId)
        {
            var mock = MockUserManager();
            mock.Setup(m => m.FindByIdAsync(userId))
                .ReturnsAsync(new IdentityUser { Id = userId, UserName = userId });
            mock.Setup(m => m.IsInRoleAsync(It.IsAny<IdentityUser>(), It.IsAny<string>()))
                .ReturnsAsync(true);
            return mock;
        }

        private static Mock<RoleManager<IdentityRole>> DefaultRoleManager()
        {
            var mock = MockRoleManager();
            mock.Setup(m => m.RoleExistsAsync(It.IsAny<string>())).ReturnsAsync(true);
            return mock;
        }

        private static Mock<ITokenService> TokenService()
        {
            var mock = new Mock<ITokenService>();
            mock.Setup(t => t.GenerateJwtForUser(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync("fresh-jwt");
            return mock;
        }

        private static IClubJoinRequestApprovalService ApprovalService(AppDbContext db, string userId)
        {
            var userManagerMock = MockUserManager();
            userManagerMock
                .Setup(m => m.FindByIdAsync(userId))
                .ReturnsAsync(new IdentityUser { Id = userId, UserName = userId });
            userManagerMock
                .Setup(m => m.IsInRoleAsync(It.IsAny<IdentityUser>(), It.IsAny<string>()))
                .ReturnsAsync(false);

            var roleManagerMock = MockRoleManager();
            roleManagerMock
                .Setup(m => m.RoleExistsAsync(It.IsAny<string>()))
                .ReturnsAsync(true);

            var billingMock = new Mock<IClubSeatBillingService>();
            billingMock
                .Setup(b => b.ChargeSeatAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new ClubSeatCharge());

            return new ClubJoinRequestApprovalService(
                db, userManagerMock.Object, roleManagerMock.Object, billingMock.Object,
                NullLogger<ClubJoinRequestApprovalService>.Instance);
        }

        private static async Task<Team> SeedClubWithTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"Join Flow Club {Guid.NewGuid():N}", SeededCountryId);
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
                Name = "Join Flow Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();
            return team;
        }

        [Fact]
        public async Task ValidateTeamCode_returns_team_to_non_member()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var team = await SeedClubWithTeamAsync(seedDb);
            await using var joinDb = _fixture.CreateDbContext($"nonmember-{Guid.NewGuid():N}");
            var handler = new ValidateTeamCode.ValidateTeamCodeHandler(joinDb);

            var result = await handler.Handle(
                new ValidateTeamCode.ValidateTeamCodeQuery(team.JoinCode), CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal(team.Id, result!.TeamId);
        }

        [Fact]
        public async Task TeamInvitationValidation_finds_team_by_join_code_for_non_member()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var team = await SeedClubWithTeamAsync(seedDb);
            await using var joinDb = _fixture.CreateDbContext($"nonmember-{Guid.NewGuid():N}");

            var validation = await TeamInvitationValidation.Validate(
                joinDb, team.JoinCode, Membership.Player, CancellationToken.None);

            Assert.True(validation.Success);
            Assert.Equal(team.Id, validation.Team!.Id);
        }

        [Fact]
        public async Task ValidateTeamJoinCode_adds_player_membership_and_returns_ok_for_non_member()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var team = await SeedClubWithTeamAsync(seedDb);
            var userId = $"nonmember-{Guid.NewGuid():N}";
            await using var joinDb = _fixture.CreateDbContext(userId);

            var handler = new ValidateTeamInvitationHandler(
                joinDb,
                DefaultUserManager(userId).Object,
                DefaultRoleManager().Object,
                TokenService().Object,
                new ScopeAuthorizationService(joinDb),
                NullLogger<ValidateTeamInvitationHandler>.Instance);
            var command = new ValidateTeamInvitationCommand
            {
                Code = team.JoinCode,
                MembershipKind = Membership.Player.Key,
                UserId = userId
            };

            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status200OK, statusCodeResult.StatusCode);
        }

        [Fact]
        public async Task EnterClubTeamAsCoach_auto_approves_pending_request_and_returns_ok_for_non_member()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var team = await SeedClubWithTeamAsync(seedDb);
            var userId = $"nonmember-{Guid.NewGuid():N}";

            await using var joinDb = _fixture.CreateDbContext(userId);
            joinDb.ClubJoinRequests.Add(ClubJoinRequest.Create(userId, team.ClubId, Membership.Coach.Id));
            await joinDb.SaveChangesAsync();

            var handler = new EnterClubTeamAsCoach.Handler(
                joinDb,
                CurrentUser(userId).Object,
                ApprovalService(joinDb, userId),
                DefaultUserManager(userId).Object,
                DefaultRoleManager().Object,
                TokenService().Object,
                NullLogger<EnterClubTeamAsCoach.Handler>.Instance);
            var command = new EnterClubTeamAsCoach.Command { Code = team.JoinCode };

            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status200OK, statusCodeResult.StatusCode);
        }

        [Fact]
        public async Task ApproveClubJoinRequest_approves_pending_request_for_club_creator()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var team = await SeedClubWithTeamAsync(seedDb);
            var creatorId = $"creator-{Guid.NewGuid():N}";
            var applicantId = $"nonmember-{Guid.NewGuid():N}";
            seedDb.UserClubs.Add(new UserClub(creatorId, team.ClubId, Membership.Directive.Id) { IsCreator = true });
            var pending = ClubJoinRequest.Create(applicantId, team.ClubId, Membership.Coach.Id);
            seedDb.ClubJoinRequests.Add(pending);
            await seedDb.SaveChangesAsync();

            await using var creatorDb = _fixture.CreateDbContext(creatorId);
            var handler = new ApproveClubJoinRequestHandler(
                creatorDb,
                new ScopeAuthorizationService(creatorDb),
                DefaultUserManager(applicantId).Object,
                ApprovalService(creatorDb, applicantId),
                null!,
                NullLogger<ApproveClubJoinRequestHandler>.Instance);
            var command = new ApproveClubJoinRequestCommand { RequestId = pending.Id, CallerUserId = creatorId };

            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status200OK, statusCodeResult.StatusCode);
        }

        [Fact]
        public async Task RejectClubJoinRequest_rejects_pending_request_for_club_creator()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var team = await SeedClubWithTeamAsync(seedDb);
            var creatorId = $"creator-{Guid.NewGuid():N}";
            var applicantId = $"nonmember-{Guid.NewGuid():N}";
            seedDb.UserClubs.Add(new UserClub(creatorId, team.ClubId, Membership.Directive.Id) { IsCreator = true });
            var pending = ClubJoinRequest.Create(applicantId, team.ClubId, Membership.Coach.Id);
            seedDb.ClubJoinRequests.Add(pending);
            await seedDb.SaveChangesAsync();

            await using var creatorDb = _fixture.CreateDbContext(creatorId);
            var handler = new RejectClubJoinRequestHandler(
                creatorDb,
                new ScopeAuthorizationService(creatorDb),
                DefaultUserManager(creatorId).Object,
                null!,
                NullLogger<RejectClubJoinRequestHandler>.Instance);
            var command = new RejectClubJoinRequestCommand { RequestId = pending.Id, CallerUserId = creatorId };

            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status200OK, statusCodeResult.StatusCode);
        }
    }
}
