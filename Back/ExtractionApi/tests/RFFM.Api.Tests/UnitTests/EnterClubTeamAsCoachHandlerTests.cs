#nullable enable
using System;
using System.Linq;
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
using RFFM.Api.Domain.Entities.Coaches;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.Invitation.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Tests for POST /api/invitations/team/enter-as-coach (see
    /// openspec/changes/coach-club-code-team-entry). A club-scoped Coach (UserClub with
    /// RoleId Coach/Directive, no matching UserTeam) enters a team code belonging to their
    /// own club and gets ConfigurationCoach.PreferredTeamId/PreferredClubId upserted.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class EnterClubTeamAsCoachHandlerTests
    {
        private const int SeededCountryId = 1;

        private readonly PostgresContainerFixture _fixture;

        public EnterClubTeamAsCoachHandlerTests(PostgresContainerFixture fixture)
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

        /// <summary>
        /// Real ClubJoinRequestApprovalService wired with Identity/billing test doubles, so tests
        /// can assert the auto-approval side effects (UserClub created, request Approved, Coach
        /// role assigned) exactly like ApproveClubJoinRequestHandler's manual-approval flow.
        /// </summary>
        private static IClubJoinRequestApprovalService ApprovalService(
            AppDbContext db, string userId, out Mock<UserManager<IdentityUser>> userManagerMock)
        {
            userManagerMock = MockUserManager();
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

        /// <summary>
        /// Strict mock that fails the test if the handler ever tries to auto-approve a
        /// ClubJoinRequest -- used for scenarios where the user already has club access (no
        /// approval needed) or has no pending request at all (must stay 403).
        /// </summary>
        private static IClubJoinRequestApprovalService NeverCalledApprovalService()
        {
            var mock = new Mock<IClubJoinRequestApprovalService>(MockBehavior.Strict);
            return mock.Object;
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
                Name = "Enter Club Team Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return team;
        }

        [Fact]
        public async Task UnknownCode_ReturnsNotFound()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = $"coach-{Guid.NewGuid():N}";

            var handler = new EnterClubTeamAsCoach.Handler(db, CurrentUser(userId).Object, NeverCalledApprovalService());
            var command = new EnterClubTeamAsCoach.Command { Code = "ZZZZZZZZ" };

            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status404NotFound, statusCodeResult.StatusCode);
        }

        [Fact]
        public async Task CodeForTeamInAnotherClub_WithNoUserClub_ReturnsForbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db, $"FC Other Club {Guid.NewGuid():N}");

            var userId = $"coach-{Guid.NewGuid():N}";
            // No UserClub row seeded for this user at all.

            var handler = new EnterClubTeamAsCoach.Handler(db, CurrentUser(userId).Object, NeverCalledApprovalService());
            var command = new EnterClubTeamAsCoach.Command { Code = team.JoinCode };

            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status403Forbidden, statusCodeResult.StatusCode);

            var config = await db.Set<ConfigurationCoach>().AsNoTracking().FirstOrDefaultAsync(c => c.CoachId == userId);
            Assert.Null(config);
        }

        [Fact]
        public async Task CodeForTeamInClub_WithClubMemberRole_ReturnsForbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db, $"FC ClubMember {Guid.NewGuid():N}");

            var userId = $"clubmember-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, team.ClubId, Membership.ClubMember.Id));
            await db.SaveChangesAsync();

            var handler = new EnterClubTeamAsCoach.Handler(db, CurrentUser(userId).Object, NeverCalledApprovalService());
            var command = new EnterClubTeamAsCoach.Command { Code = team.JoinCode };

            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status403Forbidden, statusCodeResult.StatusCode);
        }

        [Theory]
        [InlineData("")]
        [InlineData("ABC")]
        [InlineData("ABCDEFG!")]
        public async Task MalformedCode_ReturnsBadRequestViaValidator(string malformedCode)
        {
            var validator = new EnterClubTeamAsCoach.Validator();
            var command = new EnterClubTeamAsCoach.Command { Code = malformedCode };

            var validationResult = await validator.ValidateAsync(command);

            Assert.False(validationResult.IsValid);
        }

        [Fact]
        public async Task ValidCode_WithCoachRoleInClub_ReturnsOkAndCreatesConfiguration()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db, $"FC Coach {Guid.NewGuid():N}");

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, team.ClubId, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var handler = new EnterClubTeamAsCoach.Handler(db, CurrentUser(userId).Object, NeverCalledApprovalService());
            var command = new EnterClubTeamAsCoach.Command { Code = team.JoinCode };

            var result = await handler.Handle(command, CancellationToken.None);

            var okResult = Assert.IsAssignableFrom<IValueHttpResult<EnterClubTeamAsCoach.Response>>(result);
            Assert.Equal(team.Id, okResult.Value!.TeamId);
            Assert.Equal(team.Name, okResult.Value!.TeamName);

            var config = await db.Set<ConfigurationCoach>().AsNoTracking().SingleAsync(c => c.CoachId == userId);
            Assert.Equal(team.Id, config.PreferredTeamId);
            Assert.Equal(team.ClubId, config.PreferredClubId);
        }

        [Fact]
        public async Task ValidCode_WithDirectiveRoleInClub_ReturnsOk()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db, $"FC Directive {Guid.NewGuid():N}");

            var userId = $"directive-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, team.ClubId, Membership.Directive.Id));
            await db.SaveChangesAsync();

            var handler = new EnterClubTeamAsCoach.Handler(db, CurrentUser(userId).Object, NeverCalledApprovalService());
            var command = new EnterClubTeamAsCoach.Command { Code = team.JoinCode };

            var result = await handler.Handle(command, CancellationToken.None);

            var okResult = Assert.IsAssignableFrom<IValueHttpResult<EnterClubTeamAsCoach.Response>>(result);
            Assert.Equal(team.Id, okResult.Value!.TeamId);
        }

        [Fact]
        public async Task ReenteringWithCodeForDifferentTeamInSameClub_UpdatesExistingConfigurationInsteadOfDuplicating()
        {
            await using var db = _fixture.CreateDbContext();
            var club = Club.Create($"FC Multi Team {Guid.NewGuid():N}", SeededCountryId);
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

            var teamA = new Team(new TeamModelBase
            {
                Name = "Team A",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            var teamB = new Team(new TeamModelBase
            {
                Name = "Team B",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.AddRange(teamA, teamB);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var handler = new EnterClubTeamAsCoach.Handler(db, CurrentUser(userId).Object, NeverCalledApprovalService());

            var firstResult = await handler.Handle(new EnterClubTeamAsCoach.Command { Code = teamA.JoinCode }, CancellationToken.None);
            Assert.IsAssignableFrom<IValueHttpResult<EnterClubTeamAsCoach.Response>>(firstResult);

            var secondResult = await handler.Handle(new EnterClubTeamAsCoach.Command { Code = teamB.JoinCode }, CancellationToken.None);
            var okResult = Assert.IsAssignableFrom<IValueHttpResult<EnterClubTeamAsCoach.Response>>(secondResult);
            Assert.Equal(teamB.Id, okResult.Value!.TeamId);

            var configs = await db.Set<ConfigurationCoach>().AsNoTracking().Where(c => c.CoachId == userId).ToListAsync();
            Assert.Single(configs);
            Assert.Equal(teamB.Id, configs[0].PreferredTeamId);
        }

        [Fact]
        public async Task ValidCode_WithPendingCoachJoinRequestForSameClub_AutoApprovesRequestAndReturnsOk()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db, $"FC Pending Coach {Guid.NewGuid():N}");

            var userId = $"coach-{Guid.NewGuid():N}";
            var joinRequest = ClubJoinRequest.Create(userId, team.ClubId, Membership.Coach.Id);
            db.ClubJoinRequests.Add(joinRequest);
            await db.SaveChangesAsync();

            var approvalService = ApprovalService(db, userId, out var userManagerMock);
            var handler = new EnterClubTeamAsCoach.Handler(db, CurrentUser(userId).Object, approvalService);
            var command = new EnterClubTeamAsCoach.Command { Code = team.JoinCode };

            var result = await handler.Handle(command, CancellationToken.None);

            var okResult = Assert.IsAssignableFrom<IValueHttpResult<EnterClubTeamAsCoach.Response>>(result);
            Assert.Equal(team.Id, okResult.Value!.TeamId);

            var userClub = await db.UserClubs.AsNoTracking()
                .SingleAsync(uc => uc.ApplicationUserId == userId && uc.ClubId == team.ClubId);
            Assert.Equal(Membership.Coach.Id, userClub.RoleId);

            var storedRequest = await db.ClubJoinRequests.AsNoTracking().SingleAsync(r => r.Id == joinRequest.Id);
            Assert.Equal(ClubJoinRequestStatus.Approved, storedRequest.Status);
            Assert.Equal(userId, storedRequest.DecidedByUserId);

            var config = await db.Set<ConfigurationCoach>().AsNoTracking().SingleAsync(c => c.CoachId == userId);
            Assert.Equal(team.Id, config.PreferredTeamId);
            Assert.Equal(team.ClubId, config.PreferredClubId);

            userManagerMock.Verify(m => m.AddToRoleAsync(It.IsAny<IdentityUser>(), AppRoles.Coach.Name), Times.Once);
        }

        [Fact]
        public async Task ValidCode_WithPendingDirectiveJoinRequestForSameClub_AutoApprovesRequestAndReturnsOk()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db, $"FC Pending Directive {Guid.NewGuid():N}");

            var userId = $"directive-{Guid.NewGuid():N}";
            var joinRequest = ClubJoinRequest.Create(userId, team.ClubId, Membership.Directive.Id);
            db.ClubJoinRequests.Add(joinRequest);
            await db.SaveChangesAsync();

            var approvalService = ApprovalService(db, userId, out _);
            var handler = new EnterClubTeamAsCoach.Handler(db, CurrentUser(userId).Object, approvalService);
            var command = new EnterClubTeamAsCoach.Command { Code = team.JoinCode };

            var result = await handler.Handle(command, CancellationToken.None);

            var okResult = Assert.IsAssignableFrom<IValueHttpResult<EnterClubTeamAsCoach.Response>>(result);
            Assert.Equal(team.Id, okResult.Value!.TeamId);

            var userClub = await db.UserClubs.AsNoTracking()
                .SingleAsync(uc => uc.ApplicationUserId == userId && uc.ClubId == team.ClubId);
            Assert.Equal(Membership.Directive.Id, userClub.RoleId);

            var storedRequest = await db.ClubJoinRequests.AsNoTracking().SingleAsync(r => r.Id == joinRequest.Id);
            Assert.Equal(ClubJoinRequestStatus.Approved, storedRequest.Status);
        }

        [Fact]
        public async Task CodeForClub_WithNoUserClubAndNoPendingRequest_StaysForbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db, $"FC No Request {Guid.NewGuid():N}");

            var userId = $"coach-{Guid.NewGuid():N}";
            // No UserClub and no ClubJoinRequest seeded at all for this user/club.

            var handler = new EnterClubTeamAsCoach.Handler(db, CurrentUser(userId).Object, NeverCalledApprovalService());
            var command = new EnterClubTeamAsCoach.Command { Code = team.JoinCode };

            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status403Forbidden, statusCodeResult.StatusCode);

            var config = await db.Set<ConfigurationCoach>().AsNoTracking().FirstOrDefaultAsync(c => c.CoachId == userId);
            Assert.Null(config);
        }

        [Fact]
        public async Task CodeForClub_WithPendingJoinRequestForAnotherClub_StaysForbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db, $"FC Target {Guid.NewGuid():N}");
            var otherClub = Club.Create($"FC Other {Guid.NewGuid():N}", SeededCountryId);
            db.Clubs.Add(otherClub);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.ClubJoinRequests.Add(ClubJoinRequest.Create(userId, otherClub.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var handler = new EnterClubTeamAsCoach.Handler(db, CurrentUser(userId).Object, NeverCalledApprovalService());
            var command = new EnterClubTeamAsCoach.Command { Code = team.JoinCode };

            var result = await handler.Handle(command, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status403Forbidden, statusCodeResult.StatusCode);
        }
    }
}
