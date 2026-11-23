#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Trainings.Exercises;
using RFFM.Api.Infrastructure.Migrations;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>Create, update and read of the structured sheet fields, and the data migration that
    /// copies the legacy free text into them (E10).</summary>
    [Collection(PostgresCollection.Name)]
    public class ExerciseSheetFieldsPersistenceTests
    {
        private readonly PostgresContainerFixture _fixture;

        public ExerciseSheetFieldsPersistenceTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(string UserId, string ClubId)> SeedClubAsync(AppDbContext db)
        {
            var club = Club.Create($"ExerciseSheet Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            return (userId, club.Id);
        }

        private static List<NivelRowRequest> Levels(int count) =>
            Enumerable.Range(1, count).Select(n => new NivelRowRequest(n, new Dictionary<string, string>())).ToList();

        private static CreateExerciseCommand CreateCommand(string clubId, string userId) => new(
            clubId, "Rondo 4v2", "Analitico", "Objetivo", null, "", null, null, null, "",
            new List<string>(), Levels(3), null)
        {
            UserId = userId,
            Espacio = "20x30 m",
            TurnoMinutos = 3,
            NivelDibujo = 2,
            Secuencia = new List<string> { "Pase y desmarque", "Cambio de orientación" },
            Reglas = new List<string> { "Máximo dos toques" },
            QueSeVe = new List<string> { "Ritmo alto" },
            Jugadores = new List<ExerciseTeamRequest>
            {
                new("blue", "Azules", 4, "1 pivote", new List<string> { "Mantener la posesión" }),
                new(null, "Defensas", 2, null, new List<string> { "Robar", "Presionar" }),
            },
        };

        [Fact]
        public async Task Create_PersistsAndReturnsTheSheetFields()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId) = await SeedClubAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var id = await new CreateExerciseHandler(db).Handle(CreateCommand(clubId, userId), CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == id);

            Assert.Equal("20x30 m", stored.Espacio);
            Assert.Equal(3, stored.TurnoMinutos);
            Assert.Equal(2, stored.NivelDibujo);
            Assert.Equal(new List<string> { "Pase y desmarque", "Cambio de orientación" }, stored.Secuencia);
            Assert.Equal(new List<string> { "Máximo dos toques" }, stored.Reglas);
            Assert.Equal(new List<string> { "Ritmo alto" }, stored.QueSeVe);
            Assert.Equal(2, stored.Jugadores.Count);
            Assert.Equal("blue", stored.Jugadores[0].Color);
            Assert.Equal("Azules", stored.Jugadores[0].Nombre);
            Assert.Equal(4, stored.Jugadores[0].Cantidad);
            Assert.Equal("1 pivote", stored.Jugadores[0].Roles);
            Assert.Null(stored.Jugadores[1].Color);
            Assert.Equal(new List<string> { "Robar", "Presionar" }, stored.Jugadores[1].Objetivos);
        }

        [Fact]
        public async Task GetExerciseById_ReturnsTheSheetFields()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId) = await SeedClubAsync(seedDb);
            await using var createDb = _fixture.CreateDbContext();
            var id = await new CreateExerciseHandler(createDb).Handle(CreateCommand(clubId, userId), CancellationToken.None);

            await using var db = _fixture.CreateDbContext();
            var item = await new GetExerciseByIdHandler(db).Handle(new GetExerciseByIdQuery(id, userId), CancellationToken.None);

            Assert.NotNull(item);
            Assert.Equal("20x30 m", item!.Espacio);
            Assert.Equal(3, item.TurnoMinutos);
            Assert.Equal(2, item.NivelDibujo);
            Assert.Equal(2, item.Secuencia.Count);
            Assert.Equal(2, item.Jugadores.Count);
            Assert.Equal("Azules", item.Jugadores[0].Nombre);
        }

        [Fact]
        public async Task GetExercises_ReturnsTheSheetFields()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId) = await SeedClubAsync(seedDb);
            await using var createDb = _fixture.CreateDbContext();
            await new CreateExerciseHandler(createDb).Handle(CreateCommand(clubId, userId), CancellationToken.None);

            await using var db = _fixture.CreateDbContext();
            var items = await new GetExercisesHandler(db).Handle(new GetExercisesQuery(clubId, null, userId), CancellationToken.None);

            var item = Assert.Single(items);
            Assert.Equal(new List<string> { "Máximo dos toques" }, item.Reglas);
            Assert.Equal(new List<string> { "Ritmo alto" }, item.QueSeVe);
        }

        [Fact]
        public async Task Update_ReplacesTheSheetFields()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId) = await SeedClubAsync(seedDb);
            await using var createDb = _fixture.CreateDbContext();
            var id = await new CreateExerciseHandler(createDb).Handle(CreateCommand(clubId, userId), CancellationToken.None);

            var update = new UpdateExerciseCommand(
                "Rondo 5v2", "Analitico", "Objetivo", null, "", null, null, null, "",
                new List<string>(), Levels(2), null)
            {
                Id = id,
                UserId = userId,
                Espacio = "30x30 m",
                TurnoMinutos = null,
                NivelDibujo = null,
                Secuencia = new List<string> { "Nuevo paso" },
                Jugadores = new List<ExerciseTeamRequest>(),
            };
            await using var updateDb = _fixture.CreateDbContext();
            await new UpdateExerciseHandler(updateDb).Handle(update, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == id);
            Assert.Equal("30x30 m", stored.Espacio);
            Assert.Null(stored.TurnoMinutos);
            Assert.Null(stored.NivelDibujo);
            Assert.Equal(new List<string> { "Nuevo paso" }, stored.Secuencia);
            Assert.Empty(stored.Reglas);
            Assert.Empty(stored.Jugadores);
        }

        [Fact]
        public async Task Update_WithNullBoardState_KeepsTheStoredBoardState()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId) = await SeedClubAsync(seedDb);
            await using var createDb = _fixture.CreateDbContext();
            var id = await new CreateExerciseHandler(createDb).Handle(
                CreateCommand(clubId, userId) with { BoardStateJson = "{\"objects\":[]}" }, CancellationToken.None);

            var update = new UpdateExerciseCommand(
                "Rondo 4v2", "Analitico", "Objetivo", null, "", null, null, null, "",
                new List<string>(), Levels(2), null)
            { Id = id, UserId = userId };
            await using var updateDb = _fixture.CreateDbContext();
            await new UpdateExerciseHandler(updateDb).Handle(update, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == id);
            Assert.Equal("{\"objects\":[]}", stored.BoardStateJson);
        }

        private async Task<string> InsertLegacyExerciseAsync(string? descripcion, string? logistica, string? objetivoPorRol, string? dibujo = null)
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (_, clubId) = await SeedClubAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var exercise = new TaskTrainingBase
            {
                Name = "Legacy",
                Objetivo = "Objetivo",
                Descripcion = descripcion ?? string.Empty,
                Logistica = logistica ?? string.Empty,
                ObjetivoPorRol = objetivoPorRol,
                Dibujo = dibujo,
                ClubId = clubId,
            };
            exercise.UpdateNiveles(new List<string>(), new[]
            {
                new ExerciseLevelRow(1, new Dictionary<string, string>()),
                new ExerciseLevelRow(2, new Dictionary<string, string>()),
            });
            db.TaskTrainingBases.Add(exercise);
            await db.SaveChangesAsync();
            return exercise.Id;
        }

        private async Task RunBackfillAsync()
        {
            await using var db = _fixture.CreateDbContext();
            await db.Database.ExecuteSqlRawAsync(AddExerciseSheetFields.BackfillSql);
        }

        [Fact]
        public async Task Backfill_CopiesLegacyTextLiterallyWithoutSplitting()
        {
            var text = "1. Pase\n2. Desmarque\n3. Remate";
            var id = await InsertLegacyExerciseAsync(text, "20x30 m, 8 conos", "Pivote: recibir de espaldas");

            await RunBackfillAsync();

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == id);
            Assert.Equal(new List<string> { text }, stored.Secuencia);
            Assert.Equal("20x30 m, 8 conos", stored.Espacio);
            var team = Assert.Single(stored.Jugadores);
            Assert.Null(team.Color);
            Assert.Equal(new List<string> { "Pivote: recibir de espaldas" }, team.Objetivos);
        }

        [Fact]
        public async Task Backfill_CreatesNoEmptyLinesForEmptyLegacyFields()
        {
            var id = await InsertLegacyExerciseAsync("  ", "", null);

            await RunBackfillAsync();

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == id);
            Assert.Empty(stored.Secuencia);
            Assert.Null(stored.Espacio);
            Assert.Empty(stored.Jugadores);
        }

        [Fact]
        public async Task Backfill_KeepsTheLegacyColumnsIncludingDibujo()
        {
            var id = await InsertLegacyExerciseAsync("Descripción", "Logística", "Por rol", "Croquis a mano");

            await RunBackfillAsync();

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == id);
            Assert.Equal("Descripción", stored.Descripcion);
            Assert.Equal("Logística", stored.Logistica);
            Assert.Equal("Por rol", stored.ObjetivoPorRol);
            Assert.Equal("Croquis a mano", stored.Dibujo);
            Assert.Empty(stored.Reglas);
            Assert.Empty(stored.QueSeVe);
        }

        [Fact]
        public async Task Backfill_IsIdempotent_WhenRunTwice()
        {
            var id = await InsertLegacyExerciseAsync("Descripción", "Logística", "Por rol");

            await RunBackfillAsync();
            await RunBackfillAsync();

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == id);
            Assert.Equal(new List<string> { "Descripción" }, stored.Secuencia);
            Assert.Single(stored.Jugadores);
        }

        [Fact]
        public async Task Backfill_DoesNotOverwriteAnExerciseAlreadyUsingTheNewFields()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId) = await SeedClubAsync(seedDb);
            await using var createDb = _fixture.CreateDbContext();
            var id = await new CreateExerciseHandler(createDb).Handle(
                CreateCommand(clubId, userId) with { Descripcion = "Texto antiguo" }, CancellationToken.None);

            await RunBackfillAsync();

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == id);
            Assert.Equal(new List<string> { "Pase y desmarque", "Cambio de orientación" }, stored.Secuencia);
            Assert.Equal("20x30 m", stored.Espacio);
        }
    }
}
