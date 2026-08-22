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
    public class CreateExerciseHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public CreateExerciseHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(string UserId, string ClubId, Club Club)> SeedClubAsync(AppDbContext db)
        {
            var club = Club.Create($"CreateExercise Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            return (userId, club.Id, club);
        }

        private static async Task<(string SubprincipioId, string SubSubPrincipioId)> SeedAdnNodesAsync(AppDbContext db, string clubId)
        {
            var model = new GameModel(clubId, "Modelo de prueba", "2026-2027");
            var principle = new GamePrinciple(model.Id, gameMomentId: 1, key: $"principio-{Guid.NewGuid():N}", numero: 1, "Principio", "Texto");
            var subprincipio = new Subprincipio(principle.Id, $"sub-{Guid.NewGuid():N}", "1.1", "Subprincipio", "Contexto");
            var subSubPrincipio = new SubSubPrincipio($"subsub-{Guid.NewGuid():N}", "1.1.1", "Rol", "Texto", subprincipio.Id, null);

            principle.Subprincipios.Add(subprincipio);
            subprincipio.SubSubPrincipios.Add(subSubPrincipio);
            model.Principles.Add(principle);

            db.GameModels.Add(model);
            await db.SaveChangesAsync();

            return (subprincipio.Id, subSubPrincipio.Id);
        }

        private static List<NivelRowRequest> TwoLevels() => new()
        {
            new NivelRowRequest(1, new Dictionary<string, string> { ["Porterias"] = "2" }),
            new NivelRowRequest(2, new Dictionary<string, string> { ["Porterias"] = "3" }),
        };

        private static CreateExerciseCommand BaseCommand(string clubId, string userId,
            List<ExerciseModelRelationRequest>? modelRelations = null) => new(
            clubId, "Ejercicio de prueba", "Analitico", "Objetivo de prueba", null,
            "12 min, conos", null, null, null, "Descripción larga",
            new List<string> { "Porterias" }, TwoLevels(), null, modelRelations)
        { UserId = userId };

        [Fact]
        public async Task Handle_WithOnlyRequiredFields_CreatesExercise()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateExerciseHandler(db);

            var id = await handler.Handle(BaseCommand(clubId, userId), CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == id);

            Assert.Equal("Ejercicio de prueba", exercise.Name);
            Assert.Equal("Analitico", exercise.Tipo);
            Assert.Null(exercise.ObjetivoPorRol);
            Assert.Null(exercise.Porteros);
            Assert.Null(exercise.Dibujo);
            Assert.Null(exercise.DurationMinutes);
        }

        [Fact]
        public async Task Handle_PersistsNiveles()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateExerciseHandler(db);
            var id = await handler.Handle(BaseCommand(clubId, userId), CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == id);

            Assert.Equal(2, exercise.Niveles.Count);
            Assert.Equal(new List<string> { "Porterias" }, exercise.NivelesColumnas);
        }

        [Fact]
        public async Task Handle_WithModelRelationsAndItems_PersistsThem()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);
            var (subprincipioId, subSubPrincipioId) = await SeedAdnNodesAsync(seedDb, clubId);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateExerciseHandler(db);
            var relations = new List<ExerciseModelRelationRequest>
            {
                new(subprincipioId, true, new List<string> { "Pase", "Centro" },
                    new List<ExerciseModelRelationItemRequest> { new(subSubPrincipioId, false) })
            };

            var id = await handler.Handle(BaseCommand(clubId, userId, relations), CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases
                .Include(tb => tb.ModelRelations)
                    .ThenInclude(r => r.Items)
                .SingleAsync(e => e.Id == id);

            var relation = Assert.Single(exercise.ModelRelations);
            Assert.Equal(subprincipioId, relation.SubprincipioId);
            Assert.True(relation.IsFoco);
            Assert.Equal(new List<string> { "Pase", "Centro" }, relation.HabilidadesImprescindibles);
            var item = Assert.Single(relation.Items);
            Assert.Equal(subSubPrincipioId, item.SubSubPrincipioId);
            Assert.False(item.IsFoco);
        }

        [Fact]
        public async Task Handle_WithoutModelRelations_LeavesThemEmpty()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateExerciseHandler(db);
            var id = await handler.Handle(BaseCommand(clubId, userId), CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases
                .Include(tb => tb.ModelRelations)
                .SingleAsync(e => e.Id == id);

            Assert.Empty(exercise.ModelRelations);
        }

        [Theory]
        [InlineData("Analitico")]
        [InlineData("Situacional")]
        [InlineData("Global")]
        public async Task Validator_AcceptsValidTipo(string tipo)
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            var command = BaseCommand(clubId, userId) with { Tipo = tipo };
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.True(result.IsValid);
        }

        [Fact]
        public async Task Validator_RejectsInvalidTipo()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            var command = BaseCommand(clubId, userId) with { Tipo = "Integrado" };
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public async Task Validator_RejectsOneLevelRow()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            var command = BaseCommand(clubId, userId) with
            {
                Niveles = new List<NivelRowRequest> { new(1, new Dictionary<string, string>()) }
            };
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public async Task Validator_RejectsSixLevelRows()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            var command = BaseCommand(clubId, userId) with
            {
                Niveles = Enumerable.Range(1, 6).Select(n => new NivelRowRequest(n, new Dictionary<string, string>())).ToList()
            };
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public async Task Validator_RejectsRelationWithoutSubprincipio()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            var command = BaseCommand(clubId, userId, new List<ExerciseModelRelationRequest>
            {
                new("", false, null, null)
            });
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public async Task Validator_RejectsNonVocabularyHabilidad()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            var command = BaseCommand(clubId, userId, new List<ExerciseModelRelationRequest>
            {
                new("sub-1", false, new List<string> { "Regate" }, null)
            });
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.False(result.IsValid);
        }
    }
}
