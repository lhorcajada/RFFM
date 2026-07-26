#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
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

        private static async Task<string> SeedScenarioAsync(AppDbContext db, Club club)
        {
            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "CreateExercise Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var model = new GameModel(team.Id, "Modelo de prueba", "2025-2026");
            var scenario = new GameScenario(model.Id, gameMomentId: 1, gameZoneId: 1, order: 0, "Escenario 1", "Contexto");
            model.Scenarios.Add(scenario);
            db.GameModels.Add(model);
            await db.SaveChangesAsync();

            return scenario.Id;
        }

        private static CreateExerciseCommand BaseCommand(string clubId, string userId, List<string> types) => new(
            clubId, "Ejercicio de prueba", "Descripción", types,
            10, 8, 0, "Media cancha",
            SubSubPrincipleId: null,
            SubPrincipleId: null,
            ScenarioId: null,
            Section: "Principal",
            EssentialSkillIds: new List<string>(),
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

            // Validator only checks shape (never touches the DB), so a non-existent
            // SubPrincipleId is fine here — it just needs to satisfy the "exactly one of
            // SubSubPrincipleId/SubPrincipleId" rule so the Types rule is isolated.
            var command = BaseCommand(clubId, userId, new List<string>()) with { SubPrincipleId = "fake-sub-principle" };
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public async Task Validator_RejectsUnknownType()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            var command = BaseCommand(clubId, userId, new List<string> { "NotARealType" }) with { SubPrincipleId = "fake-sub-principle" };
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public async Task Validator_AcceptsAllSixValidTypes()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            var command = BaseCommand(clubId, userId, ExerciseTypesSeeder.Types.ToList()) with { SubPrincipleId = "fake-sub-principle" };
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.True(result.IsValid);
        }

        [Fact]
        public async Task Validator_AcceptsScenarioIdOnly()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            var command = BaseCommand(clubId, userId, new List<string> { "Physical" }) with { ScenarioId = "fake-scenario" };
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.True(result.IsValid);
        }

        [Fact]
        public async Task Validator_RejectsNoLevelId()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            // BaseCommand already has all three level ids null.
            var command = BaseCommand(clubId, userId, new List<string> { "Physical" });
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public async Task Validator_RejectsScenarioIdAndSubPrincipleIdTogether()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            var command = BaseCommand(clubId, userId, new List<string> { "Physical" }) with
            {
                ScenarioId = "fake-scenario",
                SubPrincipleId = "fake-sub-principle"
            };
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public async Task Validator_RejectsAllThreeLevelIdsTogether()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            var command = BaseCommand(clubId, userId, new List<string> { "Physical" }) with
            {
                ScenarioId = "fake-scenario",
                SubPrincipleId = "fake-sub-principle",
                SubSubPrincipleId = "fake-sub-sub-principle"
            };
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public async Task Handle_WithScenarioIdOnly_PersistsScenarioId()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, club) = await SeedClubAsync(seedDb);
            var scenarioId = await SeedScenarioAsync(seedDb, club);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateExerciseHandler(db);
            var command = BaseCommand(clubId, userId, new List<string> { "Physical" }) with { ScenarioId = scenarioId };

            var id = await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == id);

            Assert.Equal(scenarioId, exercise.ScenarioId);
            Assert.Null(exercise.SubPrincipleId);
            Assert.Null(exercise.SubSubPrincipleId);
        }
    }
}
