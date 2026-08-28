#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Tests for ClubJoinRequestApprovalService.ApproveAsync, in particular the guard against
    /// creating a duplicate UserClub row when the user already has one for the target club
    /// (e.g. a former ClubMember requesting to become Coach). See
    /// GetUserClubs.cs, which returns one row per UserClub and therefore surfaces duplicates as
    /// repeated clubs/teams in the frontend dashboard.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class ClubJoinRequestApprovalServiceTests
    {
        private const int SeededCountryId = 1;

        private readonly PostgresContainerFixture _fixture;

        public ClubJoinRequestApprovalServiceTests(PostgresContainerFixture fixture)
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

        private static ClubJoinRequestApprovalService ApprovalService(RFFM.Api.Infrastructure.Persistence.AppDbContext db, string userId)
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

        [Fact]
        public async Task ApproveAsync_WithExistingUserClubForSameClub_UpdatesRoleInsteadOfDuplicating()
        {
            await using var db = _fixture.CreateDbContext();
            var club = Club.Create($"FC Approval Update {Guid.NewGuid():N}", SeededCountryId);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var userId = $"user-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.ClubMember.Id));
            await db.SaveChangesAsync();

            var joinRequest = ClubJoinRequest.Create(userId, club.Id, Membership.Coach.Id);
            db.ClubJoinRequests.Add(joinRequest);
            await db.SaveChangesAsync();

            var service = ApprovalService(db, userId);

            await service.ApproveAsync(joinRequest, "admin-user", CancellationToken.None);

            var userClubs = await db.UserClubs.AsNoTracking()
                .Where(uc => uc.ApplicationUserId == userId && uc.ClubId == club.Id)
                .ToListAsync();

            var userClub = Assert.Single(userClubs);
            Assert.Equal(Membership.Coach.Id, userClub.RoleId);
        }

        [Fact]
        public async Task ApproveAsync_WithNoExistingUserClub_CreatesNewRow()
        {
            await using var db = _fixture.CreateDbContext();
            var club = Club.Create($"FC Approval Create {Guid.NewGuid():N}", SeededCountryId);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var userId = $"user-{Guid.NewGuid():N}";
            var joinRequest = ClubJoinRequest.Create(userId, club.Id, Membership.Coach.Id);
            db.ClubJoinRequests.Add(joinRequest);
            await db.SaveChangesAsync();

            var service = ApprovalService(db, userId);

            await service.ApproveAsync(joinRequest, "admin-user", CancellationToken.None);

            var userClubs = await db.UserClubs.AsNoTracking()
                .Where(uc => uc.ApplicationUserId == userId && uc.ClubId == club.Id)
                .ToListAsync();

            var userClub = Assert.Single(userClubs);
            Assert.Equal(Membership.Coach.Id, userClub.RoleId);
        }
    }
}
