#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
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
    /// Integration tests for GET /api/trainings/sessions and GET /api/trainings/sessions/{id},
    /// covering the plan-association badge (req #4/#5) and nested block/exercise shape
    /// introduced by the `session-exercise-plan-redesign` change.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class GetSessionsHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetSessionsHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string UserId, string ClubId, string TeamId, string SeasonId)> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"GetSessions Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "GetSessions Test Team", CategoryId = Category.NationalCategory.Id, ClubId = club.Id, SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            return (userId, club.Id, team.Id, season.Id);
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

        [Fact]
        public async Task Handle_SessionLinkedToPlan_IsAssociatedToPlanTrue()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, teamId, seasonId) = await SeedTeamAsync(seedDb);
            var microcicloId = await SeedMicrocicloAsync(seedDb, teamId, seasonId);
            var exerciseId = await SeedExerciseAsync(seedDb, clubId, "Ejercicio");

            await using var createDb = _fixture.CreateDbContext();
            var command = new CreateSessionCommand(
                teamId, "Sesion vinculada", null, DateTime.UtcNow, TimeSpan.FromHours(18), null, null, null, microcicloId, null, null,
                new List<SessionBlockRequest> { new(1, "Bloque 1", "Primer bloque.", null, new List<SessionBlockExerciseRequest> { new(exerciseId, 1) }) })
            { UserId = userId };
            await new CreateSessionHandler(createDb).Handle(command, CancellationToken.None);

            await using var db = _fixture.CreateDbContext();
            var result = await new GetSessionsHandler(db).Handle(new GetSessionsQuery(teamId, userId), CancellationToken.None);

            var item = Assert.Single(result);
            Assert.True(item.IsAssociatedToPlan);
            Assert.Equal(microcicloId, item.MicrocicloId);
            Assert.Equal("Semana 1", item.MicrocicloWeekLabel);
            Assert.Equal(1, item.ExerciseCount);
        }

        [Fact]
        public async Task Handle_IndependentSession_IsAssociatedToPlanFalse()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, teamId, _) = await SeedTeamAsync(seedDb);
            var exerciseId = await SeedExerciseAsync(seedDb, clubId, "Ejercicio");

            await using var createDb = _fixture.CreateDbContext();
            var command = new CreateSessionCommand(
                teamId, "Sesion independiente", null, DateTime.UtcNow, TimeSpan.FromHours(18), null, null, null, null, null, null,
                new List<SessionBlockRequest> { new(1, "Bloque 1", "Primer bloque.", null, new List<SessionBlockExerciseRequest> { new(exerciseId, 1) }) })
            { UserId = userId };
            await new CreateSessionHandler(createDb).Handle(command, CancellationToken.None);

            await using var db = _fixture.CreateDbContext();
            var result = await new GetSessionsHandler(db).Handle(new GetSessionsQuery(teamId, userId), CancellationToken.None);

            var item = Assert.Single(result);
            Assert.False(item.IsAssociatedToPlan);
            Assert.Null(item.MicrocicloId);
        }

        [Fact]
        public async Task GetSession_ReturnsOrderedBlocksAndExercises()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, teamId, _) = await SeedTeamAsync(seedDb);
            var exercise1Id = await SeedExerciseAsync(seedDb, clubId, "Ejercicio 1");
            var exercise2Id = await SeedExerciseAsync(seedDb, clubId, "Ejercicio 2");

            await using var createDb = _fixture.CreateDbContext();
            var command = new CreateSessionCommand(
                teamId, "Sesion detalle", null, DateTime.UtcNow, TimeSpan.FromHours(18), null, null, null, null, "Objetivo general", "Mapa texto",
                new List<SessionBlockRequest>
                {
                    new(1, "Bloque 1", "Primer bloque.", null, new List<SessionBlockExerciseRequest> { new(exercise1Id, 1) }),
                    new(2, "Bloque 2", "Conecta.", "Rotan.", new List<SessionBlockExerciseRequest> { new(exercise2Id, 1), new(exercise1Id, 2) }),
                })
            { UserId = userId };
            var sessionId = await new CreateSessionHandler(createDb).Handle(command, CancellationToken.None);

            await using var db = _fixture.CreateDbContext();
            var result = await new GetSessionHandler(db).Handle(new GetSessionQuery(sessionId, userId), CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal("Objetivo general", result!.ObjetivoGeneral);
            Assert.Equal("Mapa texto", result.MapaCampoTexto);
            Assert.False(result.IsAssociatedToPlan);
            Assert.Equal(2, result.Blocks.Count());
            var bloque2 = result.Blocks.Single(b => b.Order == 2);
            Assert.Equal(2, bloque2.Exercises.Count());
            Assert.Equal(exercise2Id, bloque2.Exercises.First().ExerciseId);
        }
    }
}
