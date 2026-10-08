#nullable enable
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
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
    public class GetExerciseByIdHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetExerciseByIdHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(string UserId, string ClubId, Club Club)> SeedClubAsync(AppDbContext db)
        {
            var club = Club.Create($"GetExerciseById Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            return (userId, club.Id, club);
        }

        private static List<NivelRowRequest> TwoLevels() => new()
        {
            new NivelRowRequest(1, new Dictionary<string, string>()),
            new NivelRowRequest(2, new Dictionary<string, string>()),
        };

        private static CreateExerciseCommand CreateCommand(string clubId, string userId) => new(
            clubId, "Ejercicio de prueba", "Global", "Objetivo", "Objetivo por rol", "Logistica", 15, "Porteros",
            "(pendiente)", "Descripcion", new List<string>(), TwoLevels(), null, null)
        { UserId = userId };

        [Fact]
        public async Task Handle_ReturnsFullExerciseFields()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            var exerciseId = await new CreateExerciseHandler(createDb).Handle(CreateCommand(clubId, userId), CancellationToken.None);

            await using var queryDb = _fixture.CreateDbContext();
            var result = await new GetExerciseByIdHandler(queryDb).Handle(new GetExerciseByIdQuery(exerciseId, userId), CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal("Global", result!.Tipo);
            Assert.Equal("Objetivo por rol", result.ObjetivoPorRol);
            Assert.Equal(15, result.DurationMinutes);
            Assert.Equal("Porteros", result.Porteros);
            Assert.Equal("(pendiente)", result.Dibujo);
        }

        [Fact]
        public async Task Handle_ReturnsHabilidadesOfEachRelationItem()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);
            var model = new GameModel(clubId, "Modelo de prueba", "2026-2027");
            var principle = new GamePrinciple(model.Id, gameMomentId: 1, key: $"principio-{Guid.NewGuid():N}", numero: 1, "Principio", "Texto");
            var subprincipio = new Subprincipio(principle.Id, $"sub-{Guid.NewGuid():N}", "1.1", "Subprincipio", "Contexto");
            var subSubPrincipio = new SubSubPrincipio($"subsub-{Guid.NewGuid():N}", "1.1.1", "Rol", "Texto", subprincipio.Id, null);
            principle.Subprincipios.Add(subprincipio);
            subprincipio.SubSubPrincipios.Add(subSubPrincipio);
            model.Principles.Add(principle);
            seedDb.GameModels.Add(model);
            await seedDb.SaveChangesAsync();

            var command = CreateCommand(clubId, userId) with
            {
                ModelRelations = new List<ExerciseModelRelationRequest>
                {
                    new(subprincipio.Id, true, new List<string> { "Pase" },
                        new List<ExerciseModelRelationItemRequest> { new(subSubPrincipio.Id, true, new List<string> { "Pase" }) })
                }
            };
            await using var createDb = _fixture.CreateDbContext();
            var exerciseId = await new CreateExerciseHandler(createDb).Handle(command, CancellationToken.None);

            await using var queryDb = _fixture.CreateDbContext();
            var result = await new GetExerciseByIdHandler(queryDb).Handle(new GetExerciseByIdQuery(exerciseId, userId), CancellationToken.None);

            var item = Assert.Single(Assert.Single(result!.ModelRelations).Items);
            Assert.Equal(new List<string> { "Pase" }, item.Habilidades);
        }

        [Fact]
        public async Task Handle_ForNonExistentId_ReturnsNull()
        {
            await using var db = _fixture.CreateDbContext();
            var result = await new GetExerciseByIdHandler(db).Handle(new GetExerciseByIdQuery("does-not-exist", "user-1"), CancellationToken.None);

            Assert.Null(result);
        }
    }
}
