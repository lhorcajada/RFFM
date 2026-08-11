#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
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
    public class CreateExerciseHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public CreateExerciseHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(string UserId, string ClubId, Club Club)> SeedClubAsync(AppDbContext db)
        {
            await ExerciseTypesSeeder.SeedAsync(db);

            var club = Club.Create($"CreateExercise Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            return (userId, club.Id, club);
        }

        private static CreateExerciseCommand BaseCommand(string clubId, string userId, List<string> types) => new(
            clubId, "Ejercicio de prueba", "Descripción", types,
            10, 8, 0, "Media cancha",
            Section: "Principal",
            Methodology: "Integrado",
            BoardStateJson: null,
            Series: null, DurationSeries: null, RestSeries: null,
            TouchesNumber: null, WildCards: null)
        { UserId = userId };

        [Fact]
        public async Task Handle_WithOneType_PersistsExactlyThatType()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateExerciseHandler(db);
            var command = BaseCommand(clubId, userId, new List<string> { "Physical" });

            var id = await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases
                .Include(tb => tb.Types).ThenInclude(t => t.ExerciseType)
                .SingleAsync(e => e.Id == id);

            var typeNames = exercise.Types.Select(t => t.ExerciseType.Name).ToList();
            Assert.Single(typeNames);
            Assert.Contains("Physical", typeNames);
        }

        [Fact]
        public async Task Handle_WithMultipleTypes_PersistsAllOfThem()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateExerciseHandler(db);
            var command = BaseCommand(clubId, userId, new List<string> { "Physical", "Tactical", "Game" });

            var id = await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases
                .Include(tb => tb.Types).ThenInclude(t => t.ExerciseType)
                .SingleAsync(e => e.Id == id);

            var typeNames = exercise.Types.Select(t => t.ExerciseType.Name).ToList();
            Assert.Equal(3, typeNames.Count);
            Assert.Contains("Physical", typeNames);
            Assert.Contains("Tactical", typeNames);
            Assert.Contains("Game", typeNames);
        }

        [Fact]
        public async Task Handle_WithAllSixTypes_PersistsAllSix()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateExerciseHandler(db);
            var command = BaseCommand(clubId, userId, ExerciseTypesSeeder.Types.ToList());

            var id = await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases
                .Include(tb => tb.Types).ThenInclude(t => t.ExerciseType)
                .SingleAsync(e => e.Id == id);

            Assert.Equal(6, exercise.Types.Count);
        }

        [Fact]
        public async Task Validator_RejectsEmptyTypes()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            var command = BaseCommand(clubId, userId, new List<string>());
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public async Task Validator_RejectsUnknownType()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            var command = BaseCommand(clubId, userId, new List<string> { "NotARealType" });
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public async Task Validator_AcceptsAllSixValidTypes()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            var command = BaseCommand(clubId, userId, ExerciseTypesSeeder.Types.ToList());
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.True(result.IsValid);
        }

        [Fact]
        public async Task Handle_PersistsMethodology()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateExerciseHandler(db);
            var command = BaseCommand(clubId, userId, new List<string> { "Physical" }) with { Methodology = "Global" };

            var id = await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == id);

            Assert.Equal("Global", exercise.Methodology);
        }

        [Theory]
        [InlineData("Analitico")]
        [InlineData("Integrado")]
        [InlineData("Global")]
        public async Task Validator_AcceptsValidMethodology(string methodology)
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            var command = BaseCommand(clubId, userId, new List<string> { "Physical" }) with { Methodology = methodology };
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.True(result.IsValid);
        }

        [Fact]
        public async Task Validator_RejectsInvalidMethodology()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            var command = BaseCommand(clubId, userId, new List<string> { "Physical" }) with { Methodology = "NotAValidMethodology" };
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public async Task Validator_RejectsEmptyMethodology()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            var command = BaseCommand(clubId, userId, new List<string> { "Physical" }) with { Methodology = "" };
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.False(result.IsValid);
        }
    }
}
