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
    public class UpdateExerciseHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UpdateExerciseHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(string UserId, string ClubId, Club Club)> SeedClubAsync(AppDbContext db)
        {
            await ExerciseTypesSeeder.SeedAsync(db);

            var club = Club.Create($"UpdateExercise Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            return (userId, club.Id, club);
        }

        private static async Task<string> SeedScenarioAsync(AppDbContext db, Club club)
        {
            var (scenarioId, _) = await SeedScenarioWithSubPrincipleAsync(db, club);
            return scenarioId;
        }

        private static async Task<(string ScenarioId, string SubPrincipleId)> SeedScenarioWithSubPrincipleAsync(AppDbContext db, Club club)
        {
            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "UpdateExercise Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var model = new GameModel(team.Id, "Modelo de prueba", "2025-2026");
            var scenario = new GameScenario(model.Id, gameMomentId: 1, gameZoneId: 1, order: 0, "Escenario 1", "Contexto");
            var subPrinciple = new SubPrinciple(scenario.Id, "A", "Subprincipio 1", "Contexto", order: 0);
            scenario.SubPrinciples.Add(subPrinciple);
            model.Scenarios.Add(scenario);
            db.GameModels.Add(model);
            await db.SaveChangesAsync();

            return (scenario.Id, subPrinciple.Id);
        }

        private static CreateExerciseCommand CreateCommand(string clubId, string userId, List<string> types, string? scenarioId = null) => new(
            clubId, "Ejercicio de prueba", "Descripción", types,
            10, 8, 0, "Media cancha",
            SubSubPrincipleId: null,
            SubPrincipleId: null,
            ScenarioId: scenarioId,
            Section: "Principal",
            Methodology: "Integrado",
            EssentialSkillIds: new List<string>(),
            BoardStateJson: null,
            Series: 3, DurationSeries: 30, RestSeries: 15,
            TouchesNumber: 5, WildCards: 2)
        { UserId = userId };

        private static UpdateExerciseCommand UpdateCommand(string exerciseId, string userId, List<string> types, string? scenarioId = null) => new(
            "Ejercicio actualizado", "Descripción actualizada", types,
            12, 10, 1, "Cancha completa",
            SubSubPrincipleId: null,
            SubPrincipleId: null,
            ScenarioId: scenarioId,
            Section: "Principal",
            Methodology: "Integrado",
            EssentialSkillIds: new List<string>(),
            BoardStateJson: null,
            Series: null, DurationSeries: null, RestSeries: null,
            TouchesNumber: null, WildCards: null)
        { Id = exerciseId, UserId = userId };

        [Fact]
        public async Task Handle_ReplacesTypeSet_AddsAndRemoves()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            var createHandler = new CreateExerciseHandler(createDb);
            var exerciseId = await createHandler.Handle(
                CreateCommand(clubId, userId, new List<string> { "Physical", "Tactical" }),
                CancellationToken.None);

            await using var updateDb = _fixture.CreateDbContext();
            var updateHandler = new UpdateExerciseHandler(updateDb);
            await updateHandler.Handle(
                UpdateCommand(exerciseId, userId, new List<string> { "Tactical", "Cognitive" }),
                CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases
                .Include(tb => tb.Types).ThenInclude(t => t.ExerciseType)
                .SingleAsync(e => e.Id == exerciseId);

            var typeNames = exercise.Types.Select(t => t.ExerciseType.Name).ToList();
            Assert.Equal(2, typeNames.Count);
            Assert.Contains("Tactical", typeNames);
            Assert.Contains("Cognitive", typeNames);
            Assert.DoesNotContain("Physical", typeNames);
        }

        [Fact]
        public async Task Handle_WithoutTouchingSeries_KeepsExistingValue()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            var createHandler = new CreateExerciseHandler(createDb);
            var exerciseId = await createHandler.Handle(
                CreateCommand(clubId, userId, new List<string> { "Physical" }),
                CancellationToken.None);

            await using var updateDb = _fixture.CreateDbContext();
            var updateHandler = new UpdateExerciseHandler(updateDb);
            // Series/DurationSeries/RestSeries are null in UpdateCommand -> should keep the created values.
            await updateHandler.Handle(
                UpdateCommand(exerciseId, userId, new List<string> { "Physical" }),
                CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == exerciseId);

            Assert.Equal(3, exercise.Series);
            Assert.Equal(30, exercise.DurationSeries);
            Assert.Equal(15, exercise.RestSeries);
        }

        [Fact]
        public async Task Handle_ReassignFromSubPrincipleToScenario_ClearsOldLinkAndSetsScenario()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, club) = await SeedClubAsync(seedDb);
            var (scenarioId, subPrincipleId) = await SeedScenarioWithSubPrincipleAsync(seedDb, club);

            await using var createDb = _fixture.CreateDbContext();
            var createHandler = new CreateExerciseHandler(createDb);
            var exerciseId = await createHandler.Handle(
                CreateCommand(clubId, userId, new List<string> { "Physical" }) with { SubPrincipleId = subPrincipleId },
                CancellationToken.None);

            await using var updateDb = _fixture.CreateDbContext();
            var updateHandler = new UpdateExerciseHandler(updateDb);
            await updateHandler.Handle(
                UpdateCommand(exerciseId, userId, new List<string> { "Physical" }, scenarioId: scenarioId),
                CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == exerciseId);
            Assert.Equal(scenarioId, exercise.ScenarioId);
            Assert.Null(exercise.SubPrincipleId);
            Assert.Null(exercise.SubSubPrincipleId);
        }

        [Fact]
        public async Task Handle_ReassignFromSubPrincipleToNoLevel_ClearsLink()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, club) = await SeedClubAsync(seedDb);
            var (scenarioId, subPrincipleId) = await SeedScenarioWithSubPrincipleAsync(seedDb, club);

            await using var createDb = _fixture.CreateDbContext();
            var createHandler = new CreateExerciseHandler(createDb);
            var exerciseId = await createHandler.Handle(
                CreateCommand(clubId, userId, new List<string> { "Physical" }) with { SubPrincipleId = subPrincipleId },
                CancellationToken.None);

            await using var updateDb = _fixture.CreateDbContext();
            var updateHandler = new UpdateExerciseHandler(updateDb);
            // Update with all three level ids null to unlink the exercise
            await updateHandler.Handle(
                UpdateCommand(exerciseId, userId, new List<string> { "Physical" }),
                CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == exerciseId);
            Assert.Null(exercise.ScenarioId);
            Assert.Null(exercise.SubPrincipleId);
            Assert.Null(exercise.SubSubPrincipleId);
        }

        [Fact]
        public async Task Validator_AcceptsScenarioIdOnly()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            var command = UpdateCommand("exercise-id", userId, new List<string> { "Physical" }, scenarioId: "fake-scenario");
            var validator = new UpdateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.True(result.IsValid);
        }

        [Fact]
        public async Task Validator_AcceptsNoLevelId()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            // UpdateCommand default has all three level ids null.
            var command = UpdateCommand("exercise-id", userId, new List<string> { "Physical" });
            var validator = new UpdateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.True(result.IsValid);
        }

        [Fact]
        public async Task Validator_RejectsAllThreeLevelIdsTogether()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            var command = UpdateCommand("exercise-id", userId, new List<string> { "Physical" }) with
            {
                ScenarioId = "fake-scenario",
                SubPrincipleId = "fake-sub-principle",
                SubSubPrincipleId = "fake-sub-sub-principle"
            };
            var validator = new UpdateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public async Task Handle_UpdatesMethodology()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            var createHandler = new CreateExerciseHandler(createDb);
            var exerciseId = await createHandler.Handle(
                CreateCommand(clubId, userId, new List<string> { "Physical" }),
                CancellationToken.None);

            await using var updateDb = _fixture.CreateDbContext();
            var updateHandler = new UpdateExerciseHandler(updateDb);
            await updateHandler.Handle(
                UpdateCommand(exerciseId, userId, new List<string> { "Physical" }) with { Methodology = "Global" },
                CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == exerciseId);

            Assert.Equal("Global", exercise.Methodology);
        }

        [Fact]
        public async Task Validator_RejectsInvalidMethodology()
        {
            var command = UpdateCommand("fake-id", "fake-user", new List<string> { "Physical" }) with { Methodology = "NotValid" };
            var validator = new UpdateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.False(result.IsValid);
        }
    }
}
