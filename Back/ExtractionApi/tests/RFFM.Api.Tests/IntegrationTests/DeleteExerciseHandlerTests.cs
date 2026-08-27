#nullable enable
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Trainings.Exercises;
using RFFM.Api.Features.Coaches.Trainings.Sessions;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Integration tests for DELETE /api/trainings/exercises/{id} (<see cref="DeleteExerciseCommand"/>),
    /// covering the in-use-by-session guard added by the `session-exercise-plan-redesign` change.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class DeleteExerciseHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public DeleteExerciseHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string UserId, string ClubId, string TeamId)> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"DeleteExercise Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "DeleteExercise Test Team", CategoryId = Category.NationalCategory.Id, ClubId = club.Id, SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            return (userId, club.Id, team.Id);
        }

        private static async Task<string> SeedExerciseAsync(AppDbContext db, string clubId)
        {
            var exercise = new Domain.Aggregates.Training.TasksTraining.TaskTrainingBase
            {
                Name = "Ejercicio", Tipo = "Analitico", Objetivo = "O", Logistica = "L", Descripcion = "D", ClubId = clubId,
            };
            db.TaskTrainingBases.Add(exercise);
            await db.SaveChangesAsync();
            return exercise.Id;
        }

        [Fact]
        public async Task Delete_ExerciseNotInUse_Succeeds()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedTeamAsync(seedDb);
            var exerciseId = await SeedExerciseAsync(seedDb, clubId);

            await using var db = _fixture.CreateDbContext();
            await new DeleteExerciseHandler(db).Handle(new DeleteExerciseCommand(exerciseId, userId), CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            Assert.False(await verifyDb.TaskTrainingBases.AnyAsync(e => e.Id == exerciseId));
        }

        [Fact]
        public async Task Delete_ExerciseInUseBySessionBlock_ThrowsExerciseInUseBySession()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, teamId) = await SeedTeamAsync(seedDb);
            var exerciseId = await SeedExerciseAsync(seedDb, clubId);

            await using var createSessionDb = _fixture.CreateDbContext();
            var sessionCommand = new CreateSessionCommand(
                teamId, "Sesion", null, DateTime.UtcNow, TimeSpan.FromHours(18), null, null, null, null, null, null,
                new List<SessionBlockRequest>
                {
                    new(1, "Bloque 1", "Primer bloque.", null, new List<SessionBlockExerciseRequest> { new(exerciseId, 1) })
                })
            { UserId = userId };
            await new CreateSessionHandler(createSessionDb).Handle(sessionCommand, CancellationToken.None);

            await using var db = _fixture.CreateDbContext();
            var ex = await Assert.ThrowsAsync<DomainException>(
                () => new DeleteExerciseHandler(db).Handle(new DeleteExerciseCommand(exerciseId, userId), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.ExerciseInUseBySession, ex.Code);

            await using var verifyDb = _fixture.CreateDbContext();
            Assert.True(await verifyDb.TaskTrainingBases.AnyAsync(e => e.Id == exerciseId));
        }
    }
}
