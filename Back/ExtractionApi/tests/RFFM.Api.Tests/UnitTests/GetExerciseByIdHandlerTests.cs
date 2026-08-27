#nullable enable
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
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
        public async Task Handle_ForNonExistentId_ReturnsNull()
        {
            await using var db = _fixture.CreateDbContext();
            var result = await new GetExerciseByIdHandler(db).Handle(new GetExerciseByIdQuery("does-not-exist", "user-1"), CancellationToken.None);

            Assert.Null(result);
        }
    }
}
