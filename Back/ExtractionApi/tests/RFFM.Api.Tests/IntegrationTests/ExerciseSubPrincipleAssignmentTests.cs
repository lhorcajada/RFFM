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
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class ExerciseSubPrincipleAssignmentTests
    {
        private readonly PostgresContainerFixture _fixture;

        public ExerciseSubPrincipleAssignmentTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string UserId, string ClubId, string SubPrincipleId, string SubSubPrincipleId)> SeedAsync(AppDbContext db)
        {
            var club = Club.Create($"Exercise SP Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Exercise SP Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var model = new GameModel(team.Id, "Modelo de prueba", "2025-2026");
            var scenario = new GameScenario(model.Id, gameMomentId: 1, gameZoneId: 1, order: 0, "Escenario 1", "Contexto");
            var subPrinciple = new SubPrinciple(scenario.Id, "A", "Subprincipio 1", "Contexto", order: 0);
            var subSubPrinciple = new SubSubPrinciple(subPrinciple.Id, "Sub-subprincipio 1", "Acción 1", order: 0);
            subPrinciple.SubSubPrinciples.Add(subSubPrinciple);
            scenario.SubPrinciples.Add(subPrinciple);
            model.Scenarios.Add(scenario);
            db.GameModels.Add(model);
            await db.SaveChangesAsync();

            return (userId, club.Id, subPrinciple.Id, subSubPrinciple.Id);
        }

        private static CreateExerciseCommand BaseCreateCommand(string clubId, string userId) => new(
            clubId, "Ejercicio de prueba", "Descripción", "Tactical",
            10, 8, 0, "Media cancha",
            SubSubPrincipleId: null,
            SubPrincipleId: null,
            Section: "Principal",
            EssentialSkillIds: new List<string>(),
            BoardStateJson: null,
            Series: null, DurationSeries: null, RestSeries: null,
            TouchesNumber: 0, WildCards: 0)
        { UserId = userId };

        [Fact]
        public async Task Create_WithSubPrincipleIdOnly_PersistsSubPrincipleId()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, subPrincipleId, _) = await SeedAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateExerciseHandler(db);
            var command = BaseCreateCommand(clubId, userId) with { SubPrincipleId = subPrincipleId };

            var id = await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == id);
            Assert.Equal(subPrincipleId, exercise.SubPrincipleId);
            Assert.Null(exercise.SubSubPrincipleId);
        }

        [Fact]
        public async Task Create_WithBothIds_FailsValidation()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, subPrincipleId, subSubPrincipleId) = await SeedAsync(seedDb);

            var command = BaseCreateCommand(clubId, userId) with
            {
                SubPrincipleId = subPrincipleId,
                SubSubPrincipleId = subSubPrincipleId
            };
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public async Task Create_WithNeitherId_FailsValidation()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _, _) = await SeedAsync(seedDb);

            var command = BaseCreateCommand(clubId, userId);
            var validator = new CreateExerciseValidator();

            var result = await validator.ValidateAsync(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public async Task Update_ReassignFromSubSubPrincipleToSubPrinciple_ClearsOldLink()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, subPrincipleId, subSubPrincipleId) = await SeedAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            var createHandler = new CreateExerciseHandler(createDb);
            var exerciseId = await createHandler.Handle(
                BaseCreateCommand(clubId, userId) with { SubSubPrincipleId = subSubPrincipleId },
                CancellationToken.None);

            await using var updateDb = _fixture.CreateDbContext();
            var updateHandler = new UpdateExerciseHandler(updateDb);
            var updateCommand = new UpdateExerciseCommand(
                "Ejercicio de prueba", "Descripción", 10, 8, 0, "Media cancha",
                SubSubPrincipleId: null,
                SubPrincipleId: null,
                Section: "Principal",
                EssentialSkillIds: new List<string>(),
                BoardStateJson: null,
                Series: null, DurationSeries: null, RestSeries: null,
                TouchesNumber: 0, WildCards: 0)
            { Id = exerciseId, UserId = userId, SubPrincipleId = subPrincipleId };

            await updateHandler.Handle(updateCommand, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == exerciseId);
            Assert.Equal(subPrincipleId, exercise.SubPrincipleId);
            Assert.Null(exercise.SubSubPrincipleId);
        }

        [Fact]
        public async Task Update_ReassignFromSubPrincipleToSubSubPrinciple_ClearsOldLink()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, subPrincipleId, subSubPrincipleId) = await SeedAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            var createHandler = new CreateExerciseHandler(createDb);
            var exerciseId = await createHandler.Handle(
                BaseCreateCommand(clubId, userId) with { SubPrincipleId = subPrincipleId },
                CancellationToken.None);

            await using var updateDb = _fixture.CreateDbContext();
            var updateHandler = new UpdateExerciseHandler(updateDb);
            var updateCommand = new UpdateExerciseCommand(
                "Ejercicio de prueba", "Descripción", 10, 8, 0, "Media cancha",
                SubSubPrincipleId: subSubPrincipleId,
                SubPrincipleId: null,
                Section: "Principal",
                EssentialSkillIds: new List<string>(),
                BoardStateJson: null,
                Series: null, DurationSeries: null, RestSeries: null,
                TouchesNumber: 0, WildCards: 0)
            { Id = exerciseId, UserId = userId, SubPrincipleId = null };

            await updateHandler.Handle(updateCommand, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == exerciseId);
            Assert.Equal(subSubPrincipleId, exercise.SubSubPrincipleId);
            Assert.Null(exercise.SubPrincipleId);
        }

        [Fact]
        public async Task GetExercises_FilteredBySubPrincipleId_ReturnsOnlyMatchingExercises()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, subPrincipleId, subSubPrincipleId) = await SeedAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            var createHandler = new CreateExerciseHandler(createDb);
            var spExerciseId = await createHandler.Handle(
                BaseCreateCommand(clubId, userId) with { SubPrincipleId = subPrincipleId }, CancellationToken.None);
            await createHandler.Handle(
                BaseCreateCommand(clubId, userId) with { SubSubPrincipleId = subSubPrincipleId }, CancellationToken.None);

            await using var queryDb = _fixture.CreateDbContext();
            var handler = new GetExercisesHandler(queryDb);
            var result = await handler.Handle(new GetExercisesQuery(clubId, SubSubPrincipleId: null, SubPrincipleId: subPrincipleId, UserId: userId), CancellationToken.None);

            var list = result.ToList();
            Assert.Single(list);
            Assert.Equal(spExerciseId, list[0].Id);
            Assert.Equal(subPrincipleId, list[0].SubPrincipleId);
        }

        [Fact]
        public async Task GetExerciseById_LinkedToSubPrinciple_ReturnsSubPrincipleName()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, subPrincipleId, _) = await SeedAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            var createHandler = new CreateExerciseHandler(createDb);
            var exerciseId = await createHandler.Handle(
                BaseCreateCommand(clubId, userId) with { SubPrincipleId = subPrincipleId }, CancellationToken.None);

            await using var queryDb = _fixture.CreateDbContext();
            var handler = new GetExerciseByIdHandler(queryDb);
            var result = await handler.Handle(new GetExerciseByIdQuery(exerciseId, userId), CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal(subPrincipleId, result!.SubPrincipleId);
            Assert.Equal("Subprincipio 1", result.SubPrincipleName);
        }
    }
}
