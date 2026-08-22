#nullable enable
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class TeamPlayerLinkRequestTests
    {
        [Fact]
        public void Create_WithValidData_Succeeds()
        {
            var applicationUserId = Guid.NewGuid().ToString();
            var teamId = Guid.NewGuid().ToString();
            var teamPlayerId = Guid.NewGuid().ToString();
            var membershipId = 4;

            var result = TeamPlayerLinkRequest.Create(applicationUserId, teamId, teamPlayerId, membershipId);

            Assert.NotNull(result);
            Assert.Equal(applicationUserId, result.ApplicationUserId);
            Assert.Equal(teamId, result.TeamId);
            Assert.Equal(teamPlayerId, result.TeamPlayerId);
            Assert.Equal(membershipId, result.MembershipId);
            Assert.Equal(TeamPlayerLinkRequestStatus.Pending, result.Status);
        }

        [Fact]
        public void Create_WithEmptyApplicationUserId_ThrowsDomainException()
        {
            var teamId = Guid.NewGuid().ToString();
            var teamPlayerId = Guid.NewGuid().ToString();
            var membershipId = 4;

            var ex = Assert.Throws<DomainException>(
                () => TeamPlayerLinkRequest.Create(string.Empty, teamId, teamPlayerId, membershipId)
            );
            Assert.Equal(ErrorCodes.LinkedPlayerRequired, ex.Code);
        }

        [Fact]
        public void Create_WithEmptyTeamId_ThrowsDomainException()
        {
            var applicationUserId = Guid.NewGuid().ToString();
            var teamPlayerId = Guid.NewGuid().ToString();
            var membershipId = 4;

            var ex = Assert.Throws<DomainException>(
                () => TeamPlayerLinkRequest.Create(applicationUserId, string.Empty, teamPlayerId, membershipId)
            );
            Assert.Equal(ErrorCodes.LinkedPlayerRequired, ex.Code);
        }

        [Fact]
        public void Create_WithEmptyTeamPlayerId_ThrowsDomainException()
        {
            var applicationUserId = Guid.NewGuid().ToString();
            var teamId = Guid.NewGuid().ToString();
            var membershipId = 4;

            var ex = Assert.Throws<DomainException>(
                () => TeamPlayerLinkRequest.Create(applicationUserId, teamId, string.Empty, membershipId)
            );
            Assert.Equal(ErrorCodes.LinkedPlayerRequired, ex.Code);
        }

        [Fact]
        public void Approve_WhenPending_Succeeds()
        {
            var request = TeamPlayerLinkRequest.Create(
                Guid.NewGuid().ToString(),
                Guid.NewGuid().ToString(),
                Guid.NewGuid().ToString(),
                4
            );
            var decidedByUserId = Guid.NewGuid().ToString();

            request.Approve(decidedByUserId);

            Assert.Equal(TeamPlayerLinkRequestStatus.Approved, request.Status);
            Assert.Equal(decidedByUserId, request.DecidedByUserId);
            Assert.NotNull(request.DecidedAt);
        }

        [Fact]
        public void Approve_WhenAlreadyDecided_ThrowsDomainException()
        {
            var request = TeamPlayerLinkRequest.Create(
                Guid.NewGuid().ToString(),
                Guid.NewGuid().ToString(),
                Guid.NewGuid().ToString(),
                4
            );
            var decidedByUserId = Guid.NewGuid().ToString();
            request.Approve(decidedByUserId);

            var ex = Assert.Throws<DomainException>(
                () => request.Approve(decidedByUserId)
            );
            Assert.Equal(ErrorCodes.TeamPlayerLinkRequestAlreadyDecided, ex.Code);
        }

        [Fact]
        public void Reject_WhenPending_Succeeds()
        {
            var request = TeamPlayerLinkRequest.Create(
                Guid.NewGuid().ToString(),
                Guid.NewGuid().ToString(),
                Guid.NewGuid().ToString(),
                4
            );
            var decidedByUserId = Guid.NewGuid().ToString();

            request.Reject(decidedByUserId);

            Assert.Equal(TeamPlayerLinkRequestStatus.Rejected, request.Status);
            Assert.Equal(decidedByUserId, request.DecidedByUserId);
            Assert.NotNull(request.DecidedAt);
        }

        [Fact]
        public void Reject_WhenAlreadyDecided_ThrowsDomainException()
        {
            var request = TeamPlayerLinkRequest.Create(
                Guid.NewGuid().ToString(),
                Guid.NewGuid().ToString(),
                Guid.NewGuid().ToString(),
                4
            );
            var decidedByUserId = Guid.NewGuid().ToString();
            request.Reject(decidedByUserId);

            var ex = Assert.Throws<DomainException>(
                () => request.Reject(decidedByUserId)
            );
            Assert.Equal(ErrorCodes.TeamPlayerLinkRequestAlreadyDecided, ex.Code);
        }
    }
}
