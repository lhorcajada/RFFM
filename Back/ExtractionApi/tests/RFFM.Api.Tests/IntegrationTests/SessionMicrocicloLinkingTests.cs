#nullable enable
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.SeasonPlans;
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
    /// Covers the session-side of the optional SeasonPlan/Microciclo link (design.md §1.4/§4,
    /// specs/sessions.md "Training session can optionally associate to a season plan week"):
    /// create with/without MicrocicloId, and the team cross-check.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class SessionMicrocicloLinkingTests
    {
        private readonly PostgresContainerFixture _fixture;

        public SessionMicrocicloLinkingTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string UserId, string ClubId, string TeamId)> SeedTeamAsync(AppDbContext db, string? clubSuffix = null)
        {
            var club = Club.Create($"SessionLinking Test Club {clubSuffix}{Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "SessionLinking Test Team", CategoryId = Category.NationalCategory.Id, ClubId = club.Id, SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            return (userId, club.Id, team.Id);
        }

        private static async Task<string> SeedMicrocicloAsync(AppDbContext db, string teamId, string seasonId)
        {
            var plan = new SeasonPlan(teamId, seasonId);
            var macrociclo = new Macrociclo(plan.Id, 1, "Macrociclo 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21));
            var mesociclo = new Mesociclo(macrociclo.Id, 1, "Mesociclo 1.1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21), 2);
            var microciclo = new Microciclo(mesociclo.Id, 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7));
            mesociclo.Microciclos.Add(microciclo);
            macrociclo.Mesociclos.Add(mesociclo);
            plan.Macrociclos.Add(macrociclo);
            db.SeasonPlans.Add(plan);
            await db.SaveChangesAsync();
            return microciclo.Id;
        }

        private static async Task<string> SeedExerciseAsync(AppDbContext db, string clubId)
        {
            var exercise = new Domain.Aggregates.Training.TasksTraining.TaskTrainingBase
            {
                Name = "Ejercicio", Tipo = "Analitico", Objetivo = "O", Logistica = "L", Descripcion = "D", ClubId = clubId,
            };
            db.TaskTrainingBases.Add(exercise);
            await db.SaveChangesAsync();
            return exercise.Id;
        }

        private static CreateSessionCommand Command(string teamId, string userId, string exerciseId, string? microcicloId) => new(
            teamId, "Sesion", null, DateTime.UtcNow, TimeSpan.FromHours(18), null, null, null, microcicloId, null, null,
            new List<SessionBlockRequest>
            {
                new(1, "Bloque 1", "Primer bloque.", null, new List<SessionBlockExerciseRequest> { new(exerciseId, 1) })
            })
        { UserId = userId };

        [Fact]
        public async Task Create_WithMicrocicloId_PersistsLink()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, teamId) = await SeedTeamAsync(seedDb);
            var exerciseId = await SeedExerciseAsync(seedDb, clubId);
            var team = await seedDb.Teams.SingleAsync(t => t.Id == teamId);
            var microcicloId = await SeedMicrocicloAsync(seedDb, teamId, team.SeasonId);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateSessionHandler(db);

            var sessionId = await handler.Handle(Command(teamId, userId, exerciseId, microcicloId), CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var session = await verifyDb.TrainingSessions.SingleAsync(s => s.Id == sessionId);
            Assert.Equal(microcicloId, session.MicrocicloId);
        }

        [Fact]
        public async Task Create_WithoutMicrocicloId_LeavesItNull()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, teamId) = await SeedTeamAsync(seedDb);
            var exerciseId = await SeedExerciseAsync(seedDb, clubId);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateSessionHandler(db);

            var sessionId = await handler.Handle(Command(teamId, userId, exerciseId, null), CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var session = await verifyDb.TrainingSessions.SingleAsync(s => s.Id == sessionId);
            Assert.Null(session.MicrocicloId);
        }

        [Fact]
        public async Task Create_WithMicrocicloFromAnotherTeam_ThrowsMicrocicloTeamMismatch()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, teamId) = await SeedTeamAsync(seedDb, "own-");
            var exerciseId = await SeedExerciseAsync(seedDb, clubId);

            var (_, _, otherTeamId) = await SeedTeamAsync(seedDb, "other-");
            var otherTeam = await seedDb.Teams.SingleAsync(t => t.Id == otherTeamId);
            var otherMicrocicloId = await SeedMicrocicloAsync(seedDb, otherTeamId, otherTeam.SeasonId);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateSessionHandler(db);

            var ex = await Assert.ThrowsAsync<DomainException>(
                () => handler.Handle(Command(teamId, userId, exerciseId, otherMicrocicloId), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.MicrocicloTeamMismatch, ex.Code);
        }

        [Fact]
        public async Task Create_WithUnknownMicrocicloId_ThrowsMicrocicloNotFound()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, teamId) = await SeedTeamAsync(seedDb);
            var exerciseId = await SeedExerciseAsync(seedDb, clubId);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateSessionHandler(db);

            var ex = await Assert.ThrowsAsync<DomainException>(
                () => handler.Handle(Command(teamId, userId, exerciseId, Guid.NewGuid().ToString()), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.MicrocicloNotFound, ex.Code);
        }
    }
}
