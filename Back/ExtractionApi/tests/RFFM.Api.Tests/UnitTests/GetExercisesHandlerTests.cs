#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Trainings.Exercises;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Persistence.Seed;
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
            await ExerciseTypesSeeder.SeedAsync(db);

            var club = Club.Create($"GetExercises Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            return (userId, club.Id, club);
        }

        private static CreateExerciseCommand CreateCommand(string clubId, string userId, List<string> types) => new(
            clubId, "Ejercicio de prueba", "Descripción", types,
            10, 8, 0, "Media cancha",
            Section: "Principal",
            Methodology: "Integrado",
            BoardStateJson: null,
            Series: null, DurationSeries: null, RestSeries: null,
            TouchesNumber: null, WildCards: null)
        { UserId = userId };

        [Fact]
        public async Task Handle_ProjectsTypesAsListOfNames()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            var createHandler = new CreateExerciseHandler(createDb);
            await createHandler.Handle(
                CreateCommand(clubId, userId, new List<string> { "Physical", "Game", "Psychological" }),
                CancellationToken.None);

            await using var queryDb = _fixture.CreateDbContext();
            var handler = new GetExercisesHandler(queryDb);
            var result = await handler.Handle(
                new GetExercisesQuery(clubId, Methodology: null, UserId: userId),
                CancellationToken.None);

            var item = Assert.Single(result);
            Assert.Equal(3, item.Types.Count());
            Assert.Contains("Physical", item.Types);
            Assert.Contains("Game", item.Types);
            Assert.Contains("Psychological", item.Types);
        }

        [Fact]
        public async Task Handle_ProjectsMethodology()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            var createHandler = new CreateExerciseHandler(createDb);
            await createHandler.Handle(
                CreateCommand(clubId, userId, new List<string> { "Physical" }) with { Methodology = "Analitico" },
                CancellationToken.None);

            await using var queryDb = _fixture.CreateDbContext();
            var handler = new GetExercisesHandler(queryDb);
            var result = await handler.Handle(
                new GetExercisesQuery(clubId, Methodology: null, UserId: userId),
                CancellationToken.None);

            var item = Assert.Single(result);
            Assert.Equal("Analitico", item.Methodology);
        }

        [Fact]
        public async Task Handle_FilteredByMethodology_ReturnsOnlyMatchingExercises()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            var createHandler = new CreateExerciseHandler(createDb);
            var globalId = await createHandler.Handle(
                CreateCommand(clubId, userId, new List<string> { "Tactical" }) with { Methodology = "Global" },
                CancellationToken.None);
            await createHandler.Handle(
                CreateCommand(clubId, userId, new List<string> { "Physical" }) with { Methodology = "Analitico" },
                CancellationToken.None);

            await using var queryDb = _fixture.CreateDbContext();
            var handler = new GetExercisesHandler(queryDb);
            var result = await handler.Handle(
                new GetExercisesQuery(clubId, Methodology: "Global", UserId: userId),
                CancellationToken.None);

            var list = result.ToList();
            Assert.Single(list);
            Assert.Equal(globalId, list[0].Id);
        }
    }
}
