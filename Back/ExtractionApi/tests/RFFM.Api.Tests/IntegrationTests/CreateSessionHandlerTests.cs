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
    /// Integration tests for POST /api/trainings/sessions (<see cref="CreateSessionCommand"/>),
    /// covering the block/exercise structure introduced by the
    /// `session-exercise-plan-redesign` change.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class CreateSessionHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public CreateSessionHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string UserId, string ClubId, string TeamId)> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"CreateSession Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "CreateSession Test Team", CategoryId = Category.NationalCategory.Id, ClubId = club.Id, SeasonId = season.Id
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

        [Fact]
        public async Task Handle_WithOneBlockAndOneExercise_CreatesSession()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, teamId) = await SeedTeamAsync(seedDb);
            var exerciseId = await SeedExerciseAsync(seedDb, clubId, "Ejercicio 1");

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateSessionHandler(db);
            var command = new CreateSessionCommand(
                teamId, "Sesion 1", null, DateTime.UtcNow, TimeSpan.FromHours(18), null, null, null, null, null, null,
                new List<SessionBlockRequest>
                {
                    new(1, "Bloque 1", "Primer bloque de la sesion.", null,
                        new List<SessionBlockExerciseRequest> { new(exerciseId, 1) })
                })
            { UserId = userId };

            var sessionId = await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var session = await verifyDb.TrainingSessions
                .Include(s => s.Blocks).ThenInclude(b => b.Exercises)
                .SingleAsync(s => s.Id == sessionId);

            var block = Assert.Single(session.Blocks);
            Assert.Equal("Bloque 1", block.Nombre);
            var blockExercise = Assert.Single(block.Exercises);
            Assert.Equal(exerciseId, blockExercise.TaskTrainingBaseId);
        }

        [Fact]
        public async Task Handle_WithTwoParallelExercisesInABlock_PersistsBoth()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, teamId) = await SeedTeamAsync(seedDb);
            var exercise1Id = await SeedExerciseAsync(seedDb, clubId, "Ejercicio 1");
            var exercise2Id = await SeedExerciseAsync(seedDb, clubId, "Ejercicio 2");

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateSessionHandler(db);
            var command = new CreateSessionCommand(
                teamId, "Sesion 1", null, DateTime.UtcNow, TimeSpan.FromHours(18), null, null, null, null, null, null,
                new List<SessionBlockRequest>
                {
                    new(1, "Bloque 2", "Conecta con el anterior.", "Rotan cada 6 min.",
                        new List<SessionBlockExerciseRequest> { new(exercise1Id, 1), new(exercise2Id, 2) })
                })
            { UserId = userId };

            var sessionId = await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var block = await verifyDb.Set<Domain.Aggregates.Training.SessionBlock>()
                .Include(b => b.Exercises)
                .SingleAsync(b => b.TrainingSessionId == sessionId);

            Assert.Equal(2, block.Exercises.Count);
        }

        [Fact]
        public void Validator_RejectsBlockWithoutComoConectaConAnterior_EvenForFirstBlock()
        {
            var command = new CreateSessionCommand(
                "team-1", "Sesion 1", null, DateTime.UtcNow, TimeSpan.FromHours(18), null, null, null, null, null, null,
                new List<SessionBlockRequest>
                {
                    new(1, "Bloque 1", "", null, new List<SessionBlockExerciseRequest> { new("ex-1", 1) })
                });

            var validator = new CreateSessionValidator();
            var result = validator.Validate(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validator_RejectsSessionWithNoBlocks()
        {
            var command = new CreateSessionCommand(
                "team-1", "Sesion 1", null, DateTime.UtcNow, TimeSpan.FromHours(18), null, null, null, null, null, null,
                new List<SessionBlockRequest>());

            var validator = new CreateSessionValidator();
            var result = validator.Validate(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validator_RejectsBlockWithNoExercises()
        {
            var command = new CreateSessionCommand(
                "team-1", "Sesion 1", null, DateTime.UtcNow, TimeSpan.FromHours(18), null, null, null, null, null, null,
                new List<SessionBlockRequest>
                {
                    new(1, "Bloque 1", "Conecta.", null, new List<SessionBlockExerciseRequest>())
                });

            var validator = new CreateSessionValidator();
            var result = validator.Validate(command);

            Assert.False(result.IsValid);
        }
    }
}
