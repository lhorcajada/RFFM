#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
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

        private static async Task<(string UserId, string ClubId)> SeedClubAsync(AppDbContext db)
        {
            await ExerciseTypesSeeder.SeedAsync(db);

            var club = Club.Create($"UpdateExercise Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            return (userId, club.Id);
        }

        private static CreateExerciseCommand CreateCommand(string clubId, string userId, List<string> types) => new(
            clubId, "Ejercicio de prueba", "Descripción", types,
            10, 8, 0, "Media cancha",
            SubSubPrincipleId: null,
            SubPrincipleId: null,
            Section: "Principal",
            EssentialSkillIds: new List<string>(),
            BoardStateJson: null,
            Series: 3, DurationSeries: 30, RestSeries: 15,
            TouchesNumber: 5, WildCards: 2)
        { UserId = userId };

        private static UpdateExerciseCommand UpdateCommand(string exerciseId, string userId, List<string> types) => new(
            "Ejercicio actualizado", "Descripción actualizada", types,
            12, 10, 1, "Cancha completa",
            SubSubPrincipleId: null,
            SubPrincipleId: null,
            Section: "Principal",
            EssentialSkillIds: new List<string>(),
            BoardStateJson: null,
            Series: null, DurationSeries: null, RestSeries: null,
            TouchesNumber: null, WildCards: null)
        { Id = exerciseId, UserId = userId };

        [Fact]
        public async Task Handle_ReplacesTypeSet_AddsAndRemoves()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId) = await SeedClubAsync(seedDb);

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
            var (userId, clubId) = await SeedClubAsync(seedDb);

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
    }
}
