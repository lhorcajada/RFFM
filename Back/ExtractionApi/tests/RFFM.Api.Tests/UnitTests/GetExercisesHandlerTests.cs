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

        private static async Task<string> SeedScenarioAsync(AppDbContext db, Club club)
        {
            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "GetExercises Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var model = new GameModel(team.Id, "Modelo de prueba", "2025-2026");
            var principle = new GamePrinciple(model.Id, gameMomentId: 1, gameZoneId: 1, order: 1, "Principio 1", "");
            var scenario = new GameScenario(principle.Id, order: 0, "Escenario 1", "Contexto");
            principle.Scenarios.Add(scenario);
            model.Principles.Add(principle);
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
                new GetExercisesQuery(clubId, SubSubPrincipleId: null, SubPrincipleId: null, ScenarioId: null, Methodology: null, UserId: userId),
                CancellationToken.None);

            var item = Assert.Single(result);
            Assert.Equal(3, item.Types.Count());
            Assert.Contains("Physical", item.Types);
            Assert.Contains("Game", item.Types);
            Assert.Contains("Psychological", item.Types);
        }

        [Fact]
        public async Task Handle_FilteredByScenarioId_ReturnsOnlyMatchingExercises()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, club) = await SeedClubAsync(seedDb);
            var scenarioId = await SeedScenarioAsync(seedDb, club);

            await using var createDb = _fixture.CreateDbContext();
            var createHandler = new CreateExerciseHandler(createDb);
            var scenarioExerciseId = await createHandler.Handle(
                CreateCommand(clubId, userId, new List<string> { "Tactical" }, scenarioId: scenarioId),
                CancellationToken.None);
            await createHandler.Handle(
                CreateCommand(clubId, userId, new List<string> { "Physical" }),
                CancellationToken.None);

            await using var queryDb = _fixture.CreateDbContext();
            var handler = new GetExercisesHandler(queryDb);
            var result = await handler.Handle(
                new GetExercisesQuery(clubId, SubSubPrincipleId: null, SubPrincipleId: null, ScenarioId: scenarioId, Methodology: null, UserId: userId),
                CancellationToken.None);

            var list = result.ToList();
            Assert.Single(list);
            Assert.Equal(scenarioExerciseId, list[0].Id);
            Assert.Equal(scenarioId, list[0].ScenarioId);
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
                new GetExercisesQuery(clubId, SubSubPrincipleId: null, SubPrincipleId: null, ScenarioId: null, Methodology: null, UserId: userId),
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
                new GetExercisesQuery(clubId, SubSubPrincipleId: null, SubPrincipleId: null, ScenarioId: null, Methodology: "Global", UserId: userId),
                CancellationToken.None);

            var list = result.ToList();
            Assert.Single(list);
            Assert.Equal(globalId, list[0].Id);
        }
    }
}
