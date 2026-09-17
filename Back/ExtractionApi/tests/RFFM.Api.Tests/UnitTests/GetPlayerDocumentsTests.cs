#nullable enable
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.PlayerDocuments;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetPlayerDocumentsTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetPlayerDocumentsTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task BuildResponses_WithNoneExistingDocuments_SynthesizesPending()
        {
            await using var db = _fixture.CreateDbContext();
            var teamPlayerId = await PlayerDocumentTestData.CreateTeamPlayerAsync(db);

            var docType = RFFM.Api.Domain.Entities.PlayerDocuments.DocumentType.Create("Autorización", null);
            db.DocumentTypes.Add(docType);
            await db.SaveChangesAsync();

            var responses = await GetPlayerDocuments.BuildResponses(db, teamPlayerId, CancellationToken.None);

            var response = Assert.Single(responses, r => r.DocumentTypeId == docType.Id);
            Assert.Equal("Pending", response.Status);
            Assert.Null(response.FileName);
        }

        [Fact]
        public async Task BuildResponses_WithExistingApprovedDocument_ReturnsApprovedStatus()
        {
            await using var db = _fixture.CreateDbContext();
            var teamPlayerId = await PlayerDocumentTestData.CreateTeamPlayerAsync(db);

            var docType = RFFM.Api.Domain.Entities.PlayerDocuments.DocumentType.Create("Autorización", null);
            db.DocumentTypes.Add(docType);
            await db.SaveChangesAsync();

            var doc = RFFM.Api.Domain.Entities.PlayerDocuments.PlayerDocument.Create(
                teamPlayerId, docType.Id, "file.pdf", "url/file.pdf", "application/pdf", "user-1", false);
            doc.Approve("coach-1", "OK");
            db.PlayerDocuments.Add(doc);
            await db.SaveChangesAsync();

            var responses = await GetPlayerDocuments.BuildResponses(db, teamPlayerId, CancellationToken.None);

            var response = Assert.Single(responses, r => r.DocumentTypeId == docType.Id);
            Assert.Equal("Approved", response.Status);
            Assert.NotNull(response.UploadedAt);
        }

        [Fact]
        public async Task IsOwnTeamPlayer_WithMatchingLinkedTeamPlayerId_ReturnsTrue()
        {
            await using var db = _fixture.CreateDbContext();
            var teamPlayer = await PlayerDocumentTestData.CreateTeamPlayerWithTeamAsync(db);

            var mockCurrentUser = new Mock<ICurrentUserService>();
            mockCurrentUser.Setup(x => x.UserId).Returns("user-123");

            var userTeam = new RFFM.Api.Domain.Aggregates.UserClubs.UserTeam("user-123", teamPlayer.TeamId, RFFM.Api.Domain.Aggregates.UserClubs.Membership.Player.Id);
            userTeam.LinkPlayer(teamPlayer.TeamPlayerId);
            db.Add(userTeam);
            await db.SaveChangesAsync();

            var result = await GetPlayerDocuments.IsOwnTeamPlayer(db, mockCurrentUser.Object, teamPlayer.TeamPlayerId, CancellationToken.None);
            Assert.True(result);
        }

        [Fact]
        public async Task IsOwnTeamPlayer_WithNonMatchingTeamPlayerId_ReturnsFalse()
        {
            await using var db = _fixture.CreateDbContext();
            var linkedTeamPlayer = await PlayerDocumentTestData.CreateTeamPlayerWithTeamAsync(db);
            var otherTeamPlayerId = await PlayerDocumentTestData.CreateTeamPlayerAsync(db);

            var mockCurrentUser = new Mock<ICurrentUserService>();
            mockCurrentUser.Setup(x => x.UserId).Returns("user-123");

            var userTeam = new RFFM.Api.Domain.Aggregates.UserClubs.UserTeam("user-123", linkedTeamPlayer.TeamId, RFFM.Api.Domain.Aggregates.UserClubs.Membership.Player.Id);
            userTeam.LinkPlayer(linkedTeamPlayer.TeamPlayerId);
            db.Add(userTeam);
            await db.SaveChangesAsync();

            var result = await GetPlayerDocuments.IsOwnTeamPlayer(db, mockCurrentUser.Object, otherTeamPlayerId, CancellationToken.None);
            Assert.False(result);
        }

        [Fact]
        public async Task IsPrivileged_WithCoachRole_ReturnsTrue()
        {
            var mockCurrentUser = new Mock<ICurrentUserService>();
            mockCurrentUser.Setup(x => x.Roles).Returns(new[] { "Coach" });

            var result = GetPlayerDocuments.IsPrivileged(mockCurrentUser.Object);
            Assert.True(result);
        }

        [Fact]
        public async Task IsPrivileged_WithPlayerRole_ReturnsFalse()
        {
            var mockCurrentUser = new Mock<ICurrentUserService>();
            mockCurrentUser.Setup(x => x.Roles).Returns(new[] { "Player" });

            var result = GetPlayerDocuments.IsPrivileged(mockCurrentUser.Object);
            Assert.False(result);
        }
    }
}
