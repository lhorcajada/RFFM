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
    public class UpdateTeamNoteHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UpdateTeamNoteHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<string> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"Update Note Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Update Note Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return team.Id;
        }

        [Fact]
        public async Task Handle_ExistingNote_UpdatesTextPreservingOrder()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db);
            var note = TeamNote.Create(teamId, "Texto original", 3);
            db.TeamNotes.Add(note);
            await db.SaveChangesAsync();

            var handler = new UpdateTeamNote.Handler(db);
            var result = await handler.Handle(
                new UpdateTeamNote.UpdateTeamNoteCommand { TeamId = teamId, NoteId = note.Id, Text = "Texto actualizado" },
                CancellationToken.None);

            Assert.Equal("Texto actualizado", result.Text);
            Assert.Equal(3, result.Order);

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.TeamNotes.FirstAsync(n => n.Id == note.Id);
            Assert.Equal("Texto actualizado", stored.Text);
            Assert.Equal(3, stored.Order);
        }

        [Fact]
        public async Task Handle_TeamDoesNotExist_ThrowsNotFoundException()
        {
            await using var db = _fixture.CreateDbContext();

            var handler = new UpdateTeamNote.Handler(db);

            await Assert.ThrowsAsync<NotFoundException>(
                () => handler.Handle(
                    new UpdateTeamNote.UpdateTeamNoteCommand { TeamId = "non-existent-team-id", NoteId = "note-1", Text = "Texto" },
                    CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Handle_NoteDoesNotExistForTeam_ThrowsNotFoundException()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db);

            var handler = new UpdateTeamNote.Handler(db);

            await Assert.ThrowsAsync<NotFoundException>(
                () => handler.Handle(
                    new UpdateTeamNote.UpdateTeamNoteCommand { TeamId = teamId, NoteId = "non-existent-note-id", Text = "Texto" },
                    CancellationToken.None).AsTask());
        }
    }
}
