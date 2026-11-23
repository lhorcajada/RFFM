#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Trainings.Exercises;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetExercisesHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetExercisesHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(string UserId, string ClubId, Club Club)> SeedClubAsync(AppDbContext db)
        {
            var club = Club.Create($"GetExercises Test Club {Guid.NewGuid():N}", 1);
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

        private static CreateExerciseCommand CreateCommand(string clubId, string userId) => new(
            clubId, "Ejercicio de prueba", "Analitico", "Objetivo", null, "Logistica", null, null, null,
            "Descripcion", new List<string>(), TwoLevels(), null)
        { UserId = userId };

        [Fact]
        public async Task Handle_ProjectsTipo()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            await new CreateExerciseHandler(createDb).Handle(CreateCommand(clubId, userId) with { Tipo = "Situacional" }, CancellationToken.None);

            await using var queryDb = _fixture.CreateDbContext();
            var result = await new GetExercisesHandler(queryDb).Handle(new GetExercisesQuery(clubId, Tipo: null, UserId: userId), CancellationToken.None);

            var item = Assert.Single(result);
            Assert.Equal("Situacional", item.Tipo);
        }

        [Fact]
        public async Task Handle_FilteredByTipo_ReturnsOnlyMatchingExercises()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            var createHandler = new CreateExerciseHandler(createDb);
            var globalId = await createHandler.Handle(CreateCommand(clubId, userId) with { Tipo = "Global" }, CancellationToken.None);
            await createHandler.Handle(CreateCommand(clubId, userId) with { Tipo = "Analitico" }, CancellationToken.None);

            await using var queryDb = _fixture.CreateDbContext();
            var result = await new GetExercisesHandler(queryDb).Handle(new GetExercisesQuery(clubId, Tipo: "Global", UserId: userId), CancellationToken.None);

            var list = result.ToList();
            Assert.Single(list);
            Assert.Equal(globalId, list[0].Id);
        }

        [Fact]
        public async Task Handle_ProjectsSubtipo()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            await new CreateExerciseHandler(createDb).Handle(CreateCommand(clubId, userId) with { Subtipo = "Posesion" }, CancellationToken.None);

            await using var queryDb = _fixture.CreateDbContext();
            var result = await new GetExercisesHandler(queryDb).Handle(new GetExercisesQuery(clubId, Tipo: null, UserId: userId), CancellationToken.None);

            var item = Assert.Single(result);
            Assert.Equal("Posesion", item.Subtipo);
        }

        [Fact]
        public async Task Handle_FilteredBySubtipo_ReturnsOnlyMatchingExercises()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            var createHandler = new CreateExerciseHandler(createDb);
            var rondoId = await createHandler.Handle(CreateCommand(clubId, userId) with { Subtipo = "Rondos" }, CancellationToken.None);
            await createHandler.Handle(CreateCommand(clubId, userId) with { Subtipo = "Partido" }, CancellationToken.None);
            await createHandler.Handle(CreateCommand(clubId, userId), CancellationToken.None);

            await using var queryDb = _fixture.CreateDbContext();
            var result = await new GetExercisesHandler(queryDb).Handle(
                new GetExercisesQuery(clubId, Tipo: null, UserId: userId, Subtipo: "Rondos"), CancellationToken.None);

            var item = Assert.Single(result);
            Assert.Equal(rondoId, item.Id);
        }

        [Fact]
        public async Task Handle_ForExerciseWithStoredModelRelation_DoesNotReturnGameModelFields()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);
            var subprincipioId = await SeedSubprincipioAsync(seedDb, clubId);

            await using var createDb = _fixture.CreateDbContext();
            var exerciseId = await new CreateExerciseHandler(createDb).Handle(CreateCommand(clubId, userId), CancellationToken.None);
            await using var relationDb = _fixture.CreateDbContext();
            relationDb.ExerciseModelRelations.Add(new ExerciseModelRelation(exerciseId, subprincipioId, true, null));
            await relationDb.SaveChangesAsync();

            await using var queryDb = _fixture.CreateDbContext();
            var result = await new GetExercisesHandler(queryDb).Handle(new GetExercisesQuery(clubId, Tipo: null, UserId: userId), CancellationToken.None);

            var json = JsonSerializer.Serialize(Assert.Single(result), new JsonSerializerOptions(JsonSerializerDefaults.Web));
            Assert.DoesNotContain("modelRelations", json, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("isAssociatedToGameModel", json, StringComparison.OrdinalIgnoreCase);
        }
    }
}
