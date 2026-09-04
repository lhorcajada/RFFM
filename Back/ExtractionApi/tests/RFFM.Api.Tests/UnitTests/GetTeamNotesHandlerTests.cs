#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Notes;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetTeamNotesHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetTeamNotesHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<string> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"Team Notes Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Team Notes Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return team.Id;
        }

        [Fact]
        public async Task Handle_TeamWithNoNotes_SeedsTwoDefaultNotesAndReturnsThem()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db);

            var handler = new GetTeamNotes.Handler(db);
            var result = await handler.Handle(new GetTeamNotes.GetTeamNotesQuery { TeamId = teamId }, CancellationToken.None);

            Assert.Equal(2, result.Length);
            Assert.Equal(1, result[0].Order);
            Assert.Equal(2, result[1].Order);
            Assert.Equal(GetTeamNotes.DefaultNoteText1, result[0].Text);
            Assert.Equal(GetTeamNotes.DefaultNoteText2, result[1].Text);

            await using var verifyDb = _fixture.CreateDbContext();
            var notes = await verifyDb.TeamNotes.Where(n => n.TeamId == teamId).ToListAsync();
            Assert.Equal(2, notes.Count);
        }

        [Fact]
        public async Task Handle_TeamWithExistingNotes_ReturnsThemWithoutReseeding()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db);

            var customNote = TeamNote.Create(teamId, "Nota personalizada", 1);
            db.TeamNotes.Add(customNote);
            await db.SaveChangesAsync();

            var handler = new GetTeamNotes.Handler(db);
            var result = await handler.Handle(new GetTeamNotes.GetTeamNotesQuery { TeamId = teamId }, CancellationToken.None);

            Assert.Single(result);
            Assert.Equal("Nota personalizada", result[0].Text);

            await using var verifyDb = _fixture.CreateDbContext();
            var notes = await verifyDb.TeamNotes.Where(n => n.TeamId == teamId).ToListAsync();
            Assert.Single(notes);
        }

        [Fact]
        public async Task Handle_TeamDoesNotExist_ThrowsNotFoundException()
        {
            await using var db = _fixture.CreateDbContext();

            var handler = new GetTeamNotes.Handler(db);

            await Assert.ThrowsAsync<NotFoundException>(
                () => handler.Handle(new GetTeamNotes.GetTeamNotesQuery { TeamId = "non-existent-team-id" }, CancellationToken.None).AsTask());
        }
    }
}
