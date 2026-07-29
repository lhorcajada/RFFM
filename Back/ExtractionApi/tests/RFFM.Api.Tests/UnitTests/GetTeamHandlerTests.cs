#nullable enable
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Teams.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using System;
using System.Threading;
using System.Threading.Tasks;
using Xunit;
using static RFFM.Api.Features.Coaches.Teams.Queries.GetTeam;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetTeamHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetTeamHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        // Same seeding pattern as UpdateTeamCompetitionHandlerTests.SeedTeamAsync.
        private async Task<string> SeedTeamAsync(AppDbContext db, int? rffmCompetitionId = null, int? rffmGroupId = null)
        {
            var club = Club.Create($"GetTeam Test Club {Guid.NewGuid():N}", 1);
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
                Name = "GetTeam Test Team",
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
        public async Task Handle_TeamWithRffmCompetitionAssociation_ReturnsCompetitionAndGroupIds()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db, rffmCompetitionId: 25255269, rffmGroupId: 25255283);

            var handler = new TeamsRequestHandler(db);
            var query = new TeamQuery(teamId, "any-user-id");

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(25255269, result!.RffmCompetitionId);
            Assert.Equal(25255283, result.RffmGroupId);
        }

        [Fact]
        public async Task Handle_TeamWithoutRffmCompetitionAssociation_ReturnsNullIds()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db);

            var handler = new TeamsRequestHandler(db);
            var query = new TeamQuery(teamId, "any-user-id");

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Null(result!.RffmCompetitionId);
            Assert.Null(result.RffmGroupId);
        }
    }
}
