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
    public class RejectFamilyMemberAccountHandlerTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public RejectFamilyMemberAccountHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static Mock<UserManager<IdentityUser>> MockUserManager()
        {
            var store = new Mock<IUserStore<IdentityUser>>();
            return new Mock<UserManager<IdentityUser>>(
                store.Object, null!, null!, null!, null!, null!, null!, null!, null!);
        }

        private static async Task<(Team Team, string TeamPlayerId, string FamilyMemberId, string CreatorUserId, string LinkedUserId, string RequestId)> SeedPendingRequestAsync(AppDbContext db)
        {
            var club = Club.Create($"FamilyAccounts Reject Club {Guid.NewGuid():N}", SeededCountryId);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9),
                isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "FamilyAccounts Reject Test Team",
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

        [Fact]
        public async Task RequestNotFound_ReturnsNotFound()
        {
            await using var db = _fixture.CreateDbContext();
            var userManagerMock = MockUserManager();
            var handler = new RejectFamilyMemberAccountRequestHandler(
                db, new ScopeAuthorizationService(db), userManagerMock.Object,
                NullLogger<RejectFamilyMemberAccountRequestHandler>.Instance);

            var result = await handler.Handle(new RejectFamilyMemberAccountRequestCommand
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
            var userManagerMock = MockUserManager();
            var handler = new RejectFamilyMemberAccountRequestHandler(
                db, new ScopeAuthorizationService(db), userManagerMock.Object,
                NullLogger<RejectFamilyMemberAccountRequestHandler>.Instance);

            var result = await handler.Handle(new RejectFamilyMemberAccountRequestCommand
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
            request.Reject(seed.CreatorUserId);
            await db.SaveChangesAsync();

            var userManagerMock = MockUserManager();
            var handler = new RejectFamilyMemberAccountRequestHandler(
                db, new ScopeAuthorizationService(db), userManagerMock.Object,
                NullLogger<RejectFamilyMemberAccountRequestHandler>.Instance);

            var result = await handler.Handle(new RejectFamilyMemberAccountRequestCommand
            {
                RequestId = seed.RequestId,
                CallerUserId = seed.CreatorUserId
            }, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status409Conflict, statusCodeResult.StatusCode);
        }

        [Fact]
        public async Task HappyPath_RejectsAndDeletesOrphanedIdentityUser()
        {
            await using var db = _fixture.CreateDbContext();
            var seed = await SeedPendingRequestAsync(db);

            var userManagerMock = MockUserManager();
            var linkedUser = new IdentityUser { Id = seed.LinkedUserId, UserName = "janedoe" };
            userManagerMock.Setup(m => m.FindByIdAsync(seed.LinkedUserId)).ReturnsAsync(linkedUser);
            userManagerMock.Setup(m => m.DeleteAsync(linkedUser)).ReturnsAsync(IdentityResult.Success);

            var handler = new RejectFamilyMemberAccountRequestHandler(
                db, new ScopeAuthorizationService(db), userManagerMock.Object,
                NullLogger<RejectFamilyMemberAccountRequestHandler>.Instance);

            var result = await handler.Handle(new RejectFamilyMemberAccountRequestCommand
            {
                RequestId = seed.RequestId,
                CallerUserId = seed.CreatorUserId
            }, CancellationToken.None);

            Assert.IsAssignableFrom<Ok>(result);

            await using var verifyDb = _fixture.CreateDbContext();
            var storedRequest = await verifyDb.FamilyMemberAccountRequests.SingleAsync(r => r.Id == seed.RequestId);
            Assert.Equal(FamilyMemberAccountRequestStatus.Rejected, storedRequest.Status);

            var noUserTeam = await verifyDb.UserTeams.AnyAsync(ut => ut.LinkedTeamPlayerId == seed.TeamPlayerId);
            Assert.False(noUserTeam);

            userManagerMock.Verify(m => m.DeleteAsync(linkedUser), Times.Once);
        }
    }
}
