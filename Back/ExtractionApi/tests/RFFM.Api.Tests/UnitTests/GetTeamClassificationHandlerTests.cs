#nullable enable
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Federation.Competitions.Models;
using RFFM.Api.Features.Federation.Competitions.Services;
using RFFM.Api.Features.Mobile.Competitions.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using System;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetTeamClassificationHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetTeamClassificationHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<string> SeedTeamAsync(AppDbContext db, int? rffmCompetitionId, int? rffmGroupId)
        {
            var club = Club.Create($"Classification Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Classification Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id,
                RffmCompetitionId = rffmCompetitionId,
                RffmGroupId = rffmGroupId
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return team.Id;
        }

        [Fact]
        public async Task Handle_TeamAssociatedWithCompetition_ReturnsProjectedClassification()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db, rffmCompetitionId: 25255269, rffmGroupId: 25255283);

            var competitionServiceMock = new Mock<ICompetitionService>();
            competitionServiceMock
                .Setup(s => s.GetClassification(25255283, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new ClassificationResponse
                {
                    Teams =
                    [
                        new TeamResponse
                        {
                            Position = "1",
                            TeamId = "T1",
                            TeamName = "FC Test",
                            ImageUrl = "https://example.com/shield.png",
                            Played = "10",
                            Won = "8",
                            Drawn = "1",
                            Lost = "1",
                            GoalsFor = "25",
                            GoalsAgainst = "5",
                            Points = "25"
                        }
                    ]
                });

            var handler = new GetTeamClassification.Handler(db, competitionServiceMock.Object);
            var query = new GetTeamClassification.MobileClassificationQuery { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var row = Assert.Single(result.Teams);
            Assert.Equal(1, row.Position);
            Assert.Equal("T1", row.TeamId);
            Assert.Equal("FC Test", row.TeamName);
            Assert.Equal(10, row.Played);
            Assert.Equal(8, row.Won);
            Assert.Equal(1, row.Drawn);
            Assert.Equal(1, row.Lost);
            Assert.Equal(25, row.GoalsFor);
            Assert.Equal(5, row.GoalsAgainst);
            Assert.Equal(25, row.Points);

            competitionServiceMock.Verify(s => s.GetClassification(25255283, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Handle_TeamNotAssociatedWithCompetition_ReturnsEmptyWithoutCallingService()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db, rffmCompetitionId: null, rffmGroupId: null);

            var competitionServiceMock = new Mock<ICompetitionService>();
            var handler = new GetTeamClassification.Handler(db, competitionServiceMock.Object);
            var query = new GetTeamClassification.MobileClassificationQuery { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.Empty(result.Teams);
            competitionServiceMock.Verify(
                s => s.GetClassification(It.IsAny<int>(), It.IsAny<CancellationToken>()),
                Times.Never);
        }

        [Fact]
        public async Task Handle_TeamHasOnlyGroupIdSet_ReturnsEmptyWithoutCallingService()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db, rffmCompetitionId: null, rffmGroupId: 25255283);

            var competitionServiceMock = new Mock<ICompetitionService>();
            var handler = new GetTeamClassification.Handler(db, competitionServiceMock.Object);
            var query = new GetTeamClassification.MobileClassificationQuery { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.Empty(result.Teams);
            competitionServiceMock.Verify(
                s => s.GetClassification(It.IsAny<int>(), It.IsAny<CancellationToken>()),
                Times.Never);
        }

        [Fact]
        public async Task Handle_TeamDoesNotExist_ThrowsDomainException()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var competitionServiceMock = new Mock<ICompetitionService>();
            var handler = new GetTeamClassification.Handler(db, competitionServiceMock.Object);
            var query = new GetTeamClassification.MobileClassificationQuery { TeamId = "non-existent-team-id" };

            // Act & Assert
            await Assert.ThrowsAsync<DomainException>(() => handler.Handle(query, CancellationToken.None).AsTask());
        }
    }
}
