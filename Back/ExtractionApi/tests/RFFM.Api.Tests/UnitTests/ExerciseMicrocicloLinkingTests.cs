#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.SeasonPlans;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Trainings.Exercises;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Persistence.Seed;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Covers the exercise-side of the SeasonPlan/Microciclo link (design.md Decision 4):
    /// create/update passthrough of MicrocicloId, and filtering GetExercises by it.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class ExerciseMicrocicloLinkingTests
    {
        private readonly PostgresContainerFixture _fixture;

        public ExerciseMicrocicloLinkingTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(string UserId, string ClubId, string MicrocicloId)> SeedClubAndMicrocicloAsync(AppDbContext db)
        {
            await ExerciseTypesSeeder.SeedAsync(db);

            var club = Club.Create($"ExerciseLinking Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}",
                DateTime.UtcNow,
                DateTime.UtcNow.AddMonths(9),
                isActive: true,
                club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var plan = new SeasonPlan(Guid.NewGuid().ToString(), season.Id);
            var macrociclo = new Macrociclo(plan.Id, 1, "Macrociclo 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21));
            var mesociclo = new Mesociclo(macrociclo.Id, 1, "Mesociclo 1.1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21), 2);
            var microciclo = new Microciclo(mesociclo.Id, 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "Obj A", "Obj B");
            mesociclo.Microciclos.Add(microciclo);
            macrociclo.Mesociclos.Add(mesociclo);
            plan.Macrociclos.Add(macrociclo);
            db.SeasonPlans.Add(plan);
            await db.SaveChangesAsync();

            return (userId, club.Id, microciclo.Id);
        }

        private static CreateExerciseCommand BaseCommand(string clubId, string userId, string? microcicloId) => new(
            clubId, "Ejercicio vinculado", "Descripción", new List<string> { "Physical" },
            10, 8, 0, "Media cancha",
            Section: "Principal",
            Methodology: "Integrado",
            BoardStateJson: null,
            Series: null, DurationSeries: null, RestSeries: null,
            TouchesNumber: null, WildCards: null,
            MicrocicloId: microcicloId)
        { UserId = userId };

        [Fact]
        public async Task Create_WithMicrocicloId_PersistsLink()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, microcicloId) = await SeedClubAndMicrocicloAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateExerciseHandler(db);

            var id = await handler.Handle(BaseCommand(clubId, userId, microcicloId), CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == id);
            Assert.Equal(microcicloId, exercise.MicrocicloId);
        }

        [Fact]
        public async Task Create_WithoutMicrocicloId_LeavesItNull()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, _) = await SeedClubAndMicrocicloAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateExerciseHandler(db);

            var id = await handler.Handle(BaseCommand(clubId, userId, null), CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == id);
            Assert.Null(exercise.MicrocicloId);
        }

        [Fact]
        public async Task Update_SettingMicrocicloId_PersistsLink()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, microcicloId) = await SeedClubAndMicrocicloAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            var id = await new CreateExerciseHandler(createDb).Handle(BaseCommand(clubId, userId, null), CancellationToken.None);

            await using var updateDb = _fixture.CreateDbContext();
            var updateHandler = new UpdateExerciseHandler(updateDb);
            var updateCommand = new UpdateExerciseCommand(
                "Ejercicio vinculado", "Descripción", new List<string> { "Physical" },
                10, 8, 0, "Media cancha", "Principal", "Integrado", null,
                null, null, null, null, null, MicrocicloId: microcicloId)
            { Id = id, UserId = userId };

            await updateHandler.Handle(updateCommand, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var exercise = await verifyDb.TaskTrainingBases.SingleAsync(e => e.Id == id);
            Assert.Equal(microcicloId, exercise.MicrocicloId);
        }

        [Fact]
        public async Task GetExercises_FilteredByMicrocicloId_ReturnsOnlyLinkedExercises()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, microcicloId) = await SeedClubAndMicrocicloAsync(seedDb);

            await using var createDb = _fixture.CreateDbContext();
            var createHandler = new CreateExerciseHandler(createDb);
            var linkedId = await createHandler.Handle(BaseCommand(clubId, userId, microcicloId), CancellationToken.None);
            await createHandler.Handle(BaseCommand(clubId, userId, null), CancellationToken.None);

            await using var queryDb = _fixture.CreateDbContext();
            var handler = new GetExercisesHandler(queryDb);
            var result = await handler.Handle(new GetExercisesQuery(clubId, Methodology: null, UserId: userId, MicrocicloId: microcicloId), CancellationToken.None);

            var item = Assert.Single(result);
            Assert.Equal(linkedId, item.Id);
            Assert.Equal(microcicloId, item.MicrocicloId);
        }
    }
}
