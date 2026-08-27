#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Trainings.Exercises;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class UpdateExerciseHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UpdateExerciseHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(string UserId, string ClubId, Club Club)> SeedClubAsync(AppDbContext db)
        {
            var club = Club.Create($"UpdateExercise Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            return (userId, club.Id, club);
        }

        private static async Task<string> SeedSubprincipioAsync(AppDbContext db, string clubId)
        {
            var model = new GameModel(clubId, "Modelo de prueba", "2026-2027");
            var principle = new GamePrinciple(model.Id, gameMomentId: 1, key: $"principio-{Guid.NewGuid():N}", numero: 1, "Principio", "Texto");
            var subprincipio = new Subprincipio(principle.Id, $"sub-{Guid.NewGuid():N}", "1.1", "Subprincipio", "Contexto");
            principle.Subprincipios.Add(subprincipio);
            model.Principles.Add(principle);
            db.GameModels.Add(model);
            await db.SaveChangesAsync();
            return subprincipio.Id;
        }

        private static List<NivelRowRequest> TwoLevels() => new()
        {
            new NivelRowRequest(1, new Dictionary<string, string>()),
            new NivelRowRequest(2, new Dictionary<string, string>()),
        };

        private static CreateExerciseCommand CreateCommand(string clubId, string userId,
            List<ExerciseModelRelationRequest>? modelRelations = null) => new(
            clubId, "Ejercicio de prueba", "Analitico", "Objetivo original", null,
            "Logistica original", null, null, null, "Descripcion original",
            new List<string>(), TwoLevels(), null, modelRelations)
        { UserId = userId };

        private static UpdateExerciseCommand UpdateCommand(string exerciseId, string userId,
            List<ExerciseModelRelationRequest>? modelRelations = null) => new(
            "Ejercicio actualizado", "Global", "Objetivo actualizado", "Objetivo por rol",
            "Logistica actualizada", 25, "Portero suplente", "(pendiente)", "Descripcion actualizada",
            new List<string>(), TwoLevels(), null, modelRelations)
        { Id = exerciseId, UserId = userId };

        [Fact]
        public async Task Handle_UpdatesAllScalarFields()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            var exerciseId = await new CreateExerciseHandler(createDb).Handle(CreateCommand(clubId, userId), CancellationToken.None);

            await using var updateDb = _fixture.CreateDbContext();
            await new UpdateExerciseHandler(updateDb).Handle(UpdateCommand(exerciseId, userId), CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == exerciseId);

            Assert.Equal("Ejercicio actualizado", exercise.Name);
            Assert.Equal("Global", exercise.Tipo);
            Assert.Equal("Objetivo actualizado", exercise.Objetivo);
            Assert.Equal("Objetivo por rol", exercise.ObjetivoPorRol);
            Assert.Equal(25, exercise.DurationMinutes);
            Assert.Equal("Portero suplente", exercise.Porteros);
            Assert.Equal("(pendiente)", exercise.Dibujo);
        }

        [Fact]
        public async Task Handle_ReplacesModelRelations_AddsAndRemoves()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);
            var firstSubprincipioId = await SeedSubprincipioAsync(seedDb, clubId);
            var secondSubprincipioId = await SeedSubprincipioAsync(seedDb, clubId);

            await using var createDb = _fixture.CreateDbContext();
            var exerciseId = await new CreateExerciseHandler(createDb).Handle(
                CreateCommand(clubId, userId, new List<ExerciseModelRelationRequest> { new(firstSubprincipioId, true, null, null) }),
                CancellationToken.None);

            await using var updateDb = _fixture.CreateDbContext();
            await new UpdateExerciseHandler(updateDb).Handle(
                UpdateCommand(exerciseId, userId, new List<ExerciseModelRelationRequest> { new(secondSubprincipioId, false, null, null) }),
                CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases
                .Include(tb => tb.ModelRelations)
                .SingleAsync(e => e.Id == exerciseId);

            var relation = Assert.Single(exercise.ModelRelations);
            Assert.Equal(secondSubprincipioId, relation.SubprincipioId);
            Assert.False(relation.IsFoco);
        }

        [Fact]
        public async Task Handle_UpdatesNiveles()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            var exerciseId = await new CreateExerciseHandler(createDb).Handle(CreateCommand(clubId, userId), CancellationToken.None);

            await using var updateDb = _fixture.CreateDbContext();
            var command = UpdateCommand(exerciseId, userId) with
            {
                NivelesColumnas = new List<string> { "Espacio" },
                Niveles = new List<NivelRowRequest>
                {
                    new(1, new Dictionary<string, string> { ["Espacio"] = "8x8" }),
                    new(2, new Dictionary<string, string> { ["Espacio"] = "10x10" }),
                    new(3, new Dictionary<string, string> { ["Espacio"] = "12x12" }),
                }
            };
            await new UpdateExerciseHandler(updateDb).Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == exerciseId);

            Assert.Equal(3, exercise.Niveles.Count);
        }

        [Theory]
        [InlineData("Analitico")]
        [InlineData("Situacional")]
        [InlineData("Global")]
        public async Task Validator_AcceptsValidTipo(string tipo)
        {
            var command = UpdateCommand("fake-id", "fake-user") with { Tipo = tipo };
            var validator = new UpdateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.True(result.IsValid);
        }

        [Fact]
        public async Task Validator_RejectsInvalidTipo()
        {
            var command = UpdateCommand("fake-id", "fake-user") with { Tipo = "Integrado" };
            var validator = new UpdateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.False(result.IsValid);
        }
    }
}
