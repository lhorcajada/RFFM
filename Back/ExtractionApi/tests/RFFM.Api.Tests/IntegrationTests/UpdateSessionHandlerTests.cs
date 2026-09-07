#nullable enable
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Trainings.Sessions;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Integration tests for PUT /api/trainings/sessions/{id} (<see cref="UpdateSessionCommand"/>).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class UpdateSessionHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UpdateSessionHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string UserId, string ClubId, string TeamId)> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"UpdateSession Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "UpdateSession Test Team", CategoryId = Category.NationalCategory.Id, ClubId = club.Id, SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            return (userId, club.Id, team.Id);
        }

        private static async Task<string> SeedExerciseAsync(AppDbContext db, string clubId, string name)
        {
            var exercise = new Domain.Aggregates.Training.TasksTraining.TaskTrainingBase
            {
                Name = name, Tipo = "Analitico", Objetivo = "O", Logistica = "L", Descripcion = "D", ClubId = clubId,
            };
            db.TaskTrainingBases.Add(exercise);
            await db.SaveChangesAsync();
            return exercise.Id;
        }

        private static async Task<string> SeedSessionAsync(AppDbContext db, string teamId, string userId, string exerciseId)
        {
            var handler = new CreateSessionHandler(db);
            var command = new CreateSessionCommand(
                teamId, "Sesion original", null, null, TimeSpan.FromHours(18), null, null, null, null, null, null,
                new List<SessionBlockRequest>())
            { UserId = userId };

            // A session with no Date can be saved without blocks (design.md Decision 3.1).
            return await handler.Handle(command, CancellationToken.None);
        }

        // Regression guard: the frontend sends Date as a bare "YYYY-MM-DD" string, which
        // System.Text.Json deserializes with DateTimeKind.Unspecified. The handler must
        // normalize it to Utc before it reaches Npgsql, or SaveChangesAsync throws because
        // TrainingSession.Date is mapped as `timestamp with time zone` — mirrors
        // UpdateNewsHandlerTests.Handle_WithUnspecifiedKindNewsDate_PersistsAsUtc.
        [Fact]
        public async Task Handle_WithUnspecifiedKindDate_PersistsAsUtc()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, teamId) = await SeedTeamAsync(seedDb);
            var exerciseId = await SeedExerciseAsync(seedDb, clubId, "Ejercicio 1");
            var sessionId = await SeedSessionAsync(seedDb, teamId, userId, exerciseId);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateSessionHandler(db);
            var command = new UpdateSessionCommand(
                sessionId, "Sesion con fecha sin Kind", null,
                new DateTime(2026, 9, 12, 0, 0, 0, DateTimeKind.Unspecified),
                TimeSpan.FromHours(18), null, null, null, null, null, null,
                new List<SessionBlockRequest>
                {
                    new(1, "Bloque 1", "Primer bloque de la sesion.", null,
                        new List<SessionBlockExerciseRequest> { new(exerciseId, 1) })
                },
                userId);

            await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var session = await verifyDb.TrainingSessions.SingleAsync(s => s.Id == sessionId);

            Assert.NotNull(session.Date);
            Assert.Equal(DateTimeKind.Utc, session.Date!.Value.Kind);
            Assert.Equal(new DateTime(2026, 9, 12, 0, 0, 0, DateTimeKind.Utc), session.Date);
        }
    }
}
