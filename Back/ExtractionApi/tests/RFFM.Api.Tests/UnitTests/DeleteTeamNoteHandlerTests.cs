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
    public class DeleteTeamNoteHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public DeleteTeamNoteHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<string> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"Delete Note Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Delete Note Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return team.Id;
        }

        [Fact]
        public async Task Handle_ExistingNote_DeletesIt()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db);
            var note = TeamNote.Create(teamId, "Nota a borrar", 1);
            db.TeamNotes.Add(note);
            await db.SaveChangesAsync();

            var handler = new DeleteTeamNote.Handler(db);
            await handler.Handle(new DeleteTeamNote.DeleteTeamNoteCommand { TeamId = teamId, NoteId = note.Id }, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exists = await verifyDb.TeamNotes.AnyAsync(n => n.Id == note.Id);
            Assert.False(exists);
        }

        [Fact]
        public async Task Handle_DeletingMiddleNote_LeavesOtherOrdersUntouched()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db);
            var note1 = TeamNote.Create(teamId, "Nota 1", 1);
            var note2 = TeamNote.Create(teamId, "Nota 2", 2);
            var note3 = TeamNote.Create(teamId, "Nota 3", 3);
            db.TeamNotes.AddRange(note1, note2, note3);
            await db.SaveChangesAsync();

            var handler = new DeleteTeamNote.Handler(db);
            await handler.Handle(new DeleteTeamNote.DeleteTeamNoteCommand { TeamId = teamId, NoteId = note2.Id }, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var remaining = await verifyDb.TeamNotes.Where(n => n.TeamId == teamId).OrderBy(n => n.Order).ToListAsync();
            Assert.Equal(2, remaining.Count);
            Assert.Equal(1, remaining[0].Order);
            Assert.Equal(3, remaining[1].Order);
        }

        [Fact]
        public async Task Handle_TeamDoesNotExist_ThrowsNotFoundException()
        {
            await using var db = _fixture.CreateDbContext();

            var handler = new DeleteTeamNote.Handler(db);

            await Assert.ThrowsAsync<NotFoundException>(
                () => handler.Handle(
                    new DeleteTeamNote.DeleteTeamNoteCommand { TeamId = "non-existent-team-id", NoteId = "note-1" },
                    CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Handle_NoteDoesNotExistForTeam_ThrowsNotFoundException()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db);

            var handler = new DeleteTeamNote.Handler(db);

            await Assert.ThrowsAsync<NotFoundException>(
                () => handler.Handle(
                    new DeleteTeamNote.DeleteTeamNoteCommand { TeamId = teamId, NoteId = "non-existent-note-id" },
                    CancellationToken.None).AsTask());
        }
    }
}
