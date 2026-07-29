#nullable enable
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Teams.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class UpdateTeamCompetitionHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UpdateTeamCompetitionHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        // Same seeding pattern as GetPlayerSeasonCardsHandlerTests.SeedTeamAsync.
        private async Task<string> SeedTeamAsync(AppDbContext db, int? rffmCompetitionId = null, int? rffmGroupId = null)
        {
            var club = Club.Create($"UpdateTeamCompetition Test Club {Guid.NewGuid():N}", 1);
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
                Name = "UpdateTeamCompetition Test Team",
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
        public async Task Handle_TeamWithoutAssociation_SetsRffmCompetitionAndGroupIds()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db);

            var handler = new UpdateTeamCompetitionHandler(db);
            var command = new UpdateTeamCompetitionCommand
            {
                Id = teamId,
                RffmCompetitionId = 25255269,
                RffmGroupId = 25255283
            };

            // Act
            await handler.Handle(command, CancellationToken.None);

            // Assert
            await using var verifyDb = _fixture.CreateDbContext();
            var team = await verifyDb.Teams.FindAsync(teamId);
            Assert.NotNull(team);
            Assert.Equal(25255269, team!.RffmCompetitionId);
            Assert.Equal(25255283, team.RffmGroupId);
        }

        [Fact]
        public async Task Handle_AlreadyAssociatedTeam_ClearsBothIdsWhenBothAreNull()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db, rffmCompetitionId: 111, rffmGroupId: 222);

            var handler = new UpdateTeamCompetitionHandler(db);
            var command = new UpdateTeamCompetitionCommand
            {
                Id = teamId,
                RffmCompetitionId = null,
                RffmGroupId = null
            };

            // Act
            await handler.Handle(command, CancellationToken.None);

            // Assert
            await using var verifyDb = _fixture.CreateDbContext();
            var team = await verifyDb.Teams.FindAsync(teamId);
            Assert.NotNull(team);
            Assert.Null(team!.RffmCompetitionId);
            Assert.Null(team.RffmGroupId);
        }

        [Fact]
        public async Task Handle_TeamDoesNotExist_ThrowsKeyNotFoundException()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateTeamCompetitionHandler(db);
            var command = new UpdateTeamCompetitionCommand
            {
                Id = "non-existent-team-id",
                RffmCompetitionId = 1,
                RffmGroupId = 2
            };

            // Act & Assert
            await Assert.ThrowsAsync<KeyNotFoundException>(() => handler.Handle(command, CancellationToken.None).AsTask());
        }
    }
}
