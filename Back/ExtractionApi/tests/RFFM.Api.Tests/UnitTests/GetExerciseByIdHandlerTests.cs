#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
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
    public class GetExerciseByIdHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetExerciseByIdHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(string UserId, string ClubId, Club Club)> SeedClubAsync(AppDbContext db)
        {
            await ExerciseTypesSeeder.SeedAsync(db);

            var club = Club.Create($"GetExerciseById Test Club {Guid.NewGuid():N}", 1);
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
                Name = "GetExerciseById Test Team",
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
            Series: null, DurationSeries: null, RestSeries: null,
            TouchesNumber: null, WildCards: null)
        { UserId = userId };

        [Fact]
        public async Task Handle_ReturnsTypesAssignedToExercise()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            var createHandler = new CreateExerciseHandler(createDb);
            var exerciseId = await createHandler.Handle(
                CreateCommand(clubId, userId, new List<string> { "Technical", "Tactical" }),
                CancellationToken.None);

            await using var queryDb = _fixture.CreateDbContext();
            var handler = new GetExerciseByIdHandler(queryDb);
            var result = await handler.Handle(new GetExerciseByIdQuery(exerciseId, userId), CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal(2, result!.Types.Count());
            Assert.Contains("Technical", result.Types);
            Assert.Contains("Tactical", result.Types);
        }

        [Fact]
        public async Task Handle_LinkedToScenario_ReturnsScenarioIdAndName()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, club) = await SeedClubAsync(seedDb);
            var scenarioId = await SeedScenarioAsync(seedDb, club);

            await using var createDb = _fixture.CreateDbContext();
            var createHandler = new CreateExerciseHandler(createDb);
            var exerciseId = await createHandler.Handle(
                CreateCommand(clubId, userId, new List<string> { "Tactical" }, scenarioId: scenarioId),
                CancellationToken.None);

            await using var queryDb = _fixture.CreateDbContext();
            var handler = new GetExerciseByIdHandler(queryDb);
            var result = await handler.Handle(new GetExerciseByIdQuery(exerciseId, userId), CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal(scenarioId, result!.ScenarioId);
            Assert.Equal("Escenario 1", result.ScenarioName);
        }

        [Fact]
        public async Task Handle_ReturnsMethodology()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            var createHandler = new CreateExerciseHandler(createDb);
            var exerciseId = await createHandler.Handle(
                CreateCommand(clubId, userId, new List<string> { "Physical" }) with { Methodology = "Global" },
                CancellationToken.None);

            await using var queryDb = _fixture.CreateDbContext();
            var handler = new GetExerciseByIdHandler(queryDb);
            var result = await handler.Handle(new GetExerciseByIdQuery(exerciseId, userId), CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal("Global", result!.Methodology);
        }
    }
}
