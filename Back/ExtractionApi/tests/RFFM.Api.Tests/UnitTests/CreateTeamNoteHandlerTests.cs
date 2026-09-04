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
    public class CreateTeamNoteHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public CreateTeamNoteHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<string> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"Create Note Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Create Note Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return team.Id;
        }

        [Fact]
        public async Task Handle_FirstNote_CreatesWithOrder1()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db);

            var handler = new CreateTeamNote.Handler(db);
            var result = await handler.Handle(
                new CreateTeamNote.CreateTeamNoteCommand { TeamId = teamId, Text = "Primera nota" },
                CancellationToken.None);

            Assert.Equal("Primera nota", result.Text);
            Assert.Equal(1, result.Order);
            Assert.Equal(teamId, result.TeamId);

            await using var verifyDb = _fixture.CreateDbContext();
            var notes = await verifyDb.TeamNotes.Where(n => n.TeamId == teamId).ToListAsync();
            Assert.Single(notes);
        }

        [Fact]
        public async Task Handle_SecondNote_GetsNextOrder()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db);
            db.TeamNotes.Add(TeamNote.Create(teamId, "Nota existente", 1));
            await db.SaveChangesAsync();

            var handler = new CreateTeamNote.Handler(db);
            var result = await handler.Handle(
                new CreateTeamNote.CreateTeamNoteCommand { TeamId = teamId, Text = "Segunda nota" },
                CancellationToken.None);

            Assert.Equal(2, result.Order);

            await using var verifyDb = _fixture.CreateDbContext();
            var notes = await verifyDb.TeamNotes.Where(n => n.TeamId == teamId).OrderBy(n => n.Order).ToListAsync();
            Assert.Equal(2, notes.Count);
            Assert.Equal(1, notes[0].Order);
            Assert.Equal(2, notes[1].Order);
        }

        [Fact]
        public async Task Handle_TeamDoesNotExist_ThrowsNotFoundException()
        {
            await using var db = _fixture.CreateDbContext();

            var handler = new CreateTeamNote.Handler(db);

            await Assert.ThrowsAsync<NotFoundException>(
                () => handler.Handle(
                    new CreateTeamNote.CreateTeamNoteCommand { TeamId = "non-existent-team-id", Text = "Nota" },
                    CancellationToken.None).AsTask());
        }
    }
}
