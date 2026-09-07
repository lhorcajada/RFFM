#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Trainings.Sessions;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Integration tests for POST /api/trainings/sessions/bulk-delete (<see cref="DeleteSessionsCommand"/>),
    /// covering multi-select bulk delete on the Sesiones tab.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class DeleteSessionsHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public DeleteSessionsHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string UserId, string ClubId, string TeamId)> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"DeleteSessions Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "DeleteSessions Test Team", CategoryId = Category.NationalCategory.Id, ClubId = club.Id, SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            return (userId, club.Id, team.Id);
        }

        private static async Task<string> SeedExerciseAsync(AppDbContext db, string clubId, string name)
        {
            var exercise = new Domain.Aggregates.Training.TasksTraining.TaskTrainingBase
            {
                Name = name, Tipo = "Analitico", Objetivo = "O", Logistica = "L", Descripcion = "D", ClubId = clubId,
            };
            db.TaskTrainingBases.Add(exercise);
            await db.SaveChangesAsync();
            return exercise.Id;
        }

        private static async Task<string> SeedSessionAsync(AppDbContext db, string teamId, string userId, string exerciseId, string name)
        {
            var handler = new CreateSessionHandler(db);
            var command = new CreateSessionCommand(
                teamId, name, null, DateTime.UtcNow, TimeSpan.FromHours(18), null, null, null, null, null, null,
                new List<SessionBlockRequest>
                {
                    new(1, "Bloque 1", "Primer bloque de la sesion.", null,
                        new List<SessionBlockExerciseRequest> { new(exerciseId, 1) })
                })
            { UserId = userId };

            return await handler.Handle(command, CancellationToken.None);
        }

        [Fact]
        public async Task Handle_WithMultipleOwnedSessions_DeletesAllAndReturnsCount()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, teamId) = await SeedTeamAsync(seedDb);
            var exerciseId = await SeedExerciseAsync(seedDb, clubId, "Ejercicio 1");
            var session1Id = await SeedSessionAsync(seedDb, teamId, userId, exerciseId, "Sesion 1");
            var session2Id = await SeedSessionAsync(seedDb, teamId, userId, exerciseId, "Sesion 2");

            await using var db = _fixture.CreateDbContext();
            var handler = new DeleteSessionsHandler(db);
            var command = new DeleteSessionsCommand(new[] { session1Id, session2Id }, userId);

            var deletedCount = await handler.Handle(command, CancellationToken.None);

            Assert.Equal(2, deletedCount);

            await using var verifyDb = _fixture.CreateDbContext();
            var remaining = await verifyDb.TrainingSessions
                .Where(s => s.Id == session1Id || s.Id == session2Id)
                .ToListAsync();
            Assert.Empty(remaining);
        }

        [Fact]
        public async Task Handle_WithSessionFromAnotherClub_SkipsItAndDeletesOnlyOwned()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, teamId) = await SeedTeamAsync(seedDb);
            var exerciseId = await SeedExerciseAsync(seedDb, clubId, "Ejercicio 1");
            var ownedSessionId = await SeedSessionAsync(seedDb, teamId, userId, exerciseId, "Sesion propia");

            var (otherUserId, otherClubId, otherTeamId) = await SeedTeamAsync(seedDb);
            var otherExerciseId = await SeedExerciseAsync(seedDb, otherClubId, "Ejercicio ajeno");
            var foreignSessionId = await SeedSessionAsync(seedDb, otherTeamId, otherUserId, otherExerciseId, "Sesion ajena");

            await using var db = _fixture.CreateDbContext();
            var handler = new DeleteSessionsHandler(db);
            var command = new DeleteSessionsCommand(new[] { ownedSessionId, foreignSessionId }, userId);

            var deletedCount = await handler.Handle(command, CancellationToken.None);

            Assert.Equal(1, deletedCount);

            await using var verifyDb = _fixture.CreateDbContext();
            Assert.False(await verifyDb.TrainingSessions.AnyAsync(s => s.Id == ownedSessionId));
            Assert.True(await verifyDb.TrainingSessions.AnyAsync(s => s.Id == foreignSessionId));
        }

        [Fact]
        public async Task Handle_WithEmptyIdList_ReturnsZeroAndDeletesNothing()
        {
            await using var db = _fixture.CreateDbContext();
            var handler = new DeleteSessionsHandler(db);
            var command = new DeleteSessionsCommand(Array.Empty<string>(), "any-user");

            var deletedCount = await handler.Handle(command, CancellationToken.None);

            Assert.Equal(0, deletedCount);
        }
    }
}
