#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.SeasonPlans;
using RFFM.Api.Domain.Aggregates.Training;
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
                new List<SessionBlockRequest> { new(1, "Bloque 1", null, new List<SessionBlockExerciseRequest> { new(exerciseId, 1) }) })
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
                new List<SessionBlockRequest> { new(1, "Bloque 1", null, new List<SessionBlockExerciseRequest> { new(exerciseId, 1) }) })
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
                    new(1, "Bloque 1", null, new List<SessionBlockExerciseRequest> { new(exercise1Id, 1) }),
                    new(2, "Bloque 2", "Rotan.", new List<SessionBlockExerciseRequest> { new(exercise2Id, 1), new(exercise1Id, 2) }),
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
    
        [Fact]
        public async Task GetSession_ReturnsTheTextOfEachTargetedSubSubPrincipio()
        {
            await using var db = _fixture.CreateDbContext();
            var (userId, _, teamId, _) = await SeedTeamAsync(db);
            var model = new GameModel(teamId, "Modelo", "2026-2027");
            var principle = new GamePrinciple(model.Id, gameMomentId: 1, key: $"p-{Guid.NewGuid():N}", numero: 2, "Ataque posicional", "Texto");
            var subprincipio = new Subprincipio(principle.Id, $"sp-{Guid.NewGuid():N}", "2.3", "Circular para desordenar", "Texto");
            var ssp = new SubSubPrincipio($"ssp-{Guid.NewGuid():N}", "2.3.1", "Extremo",
                "Fija por dentro para liberar el pasillo al lateral.", subprincipio.Id, null);
            subprincipio.SubSubPrincipios.Add(ssp);
            principle.Subprincipios.Add(subprincipio);
            model.Principles.Add(principle);
            db.GameModels.Add(model);
            var session = new TrainingSession { TeamId = teamId, Name = "Sesión con objetivos", Date = DateTime.UtcNow };
            session.ReplaceTargets(new[] { ssp.Id });
            db.TrainingSessions.Add(session);
            await db.SaveChangesAsync();

            await using var readDb = _fixture.CreateDbContext();
            var result = await new GetSessionHandler(readDb).Handle(new GetSessionQuery(session.Id, userId), CancellationToken.None);

            var target = Assert.Single(result!.Targets);
            Assert.Equal("Extremo", target.Rol);
            Assert.Equal("Fija por dentro para liberar el pasillo al lateral.", target.Texto);
        }

        private static async Task<string> SeedSessionAsync(AppDbContext db, string teamId, string name, DateTime? date, string? microcicloId = null)
        {
            var session = new TrainingSession { TeamId = teamId, Name = name, Date = date, MicrocicloId = microcicloId };
            db.TrainingSessions.Add(session);
            await db.SaveChangesAsync();
            return session.Id;
        }

        private static async Task<Season> SeedSeasonAsync(AppDbContext db, string clubId, DateTime start, DateTime end)
        {
            var club = await db.Clubs.FindAsync(clubId);
            var season = Season.Create($"Season {Guid.NewGuid():N}", start, end, isActive: false, club: club!);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();
            return season;
        }

        [Fact]
        public async Task Handle_WithSeasonId_ReturnsSessionsOfThatSeasonPlanAndFreeSessionsWithinItsDates()
        {
            await using var db = _fixture.CreateDbContext();
            var (userId, clubId, teamId, _) = await SeedTeamAsync(db);
            var season = await SeedSeasonAsync(db, clubId, new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc), new DateTime(2027, 6, 30, 0, 0, 0, DateTimeKind.Utc));
            var otherSeason = await SeedSeasonAsync(db, clubId, new DateTime(2025, 7, 1, 0, 0, 0, DateTimeKind.Utc), new DateTime(2026, 6, 30, 0, 0, 0, DateTimeKind.Utc));
            var microcicloId = await SeedMicrocicloAsync(db, teamId, season.Id);
            var otherMicrocicloId = await SeedMicrocicloAsync(db, teamId, otherSeason.Id);

            var planned = await SeedSessionAsync(db, teamId, "Plan temporada", new DateTime(2026, 9, 2, 0, 0, 0, DateTimeKind.Utc), microcicloId);
            await SeedSessionAsync(db, teamId, "Plan otra temporada", new DateTime(2026, 9, 3, 0, 0, 0, DateTimeKind.Utc), otherMicrocicloId);
            var freeInside = await SeedSessionAsync(db, teamId, "Libre dentro", new DateTime(2027, 6, 30, 18, 0, 0, DateTimeKind.Utc));
            await SeedSessionAsync(db, teamId, "Libre fuera", new DateTime(2027, 7, 1, 0, 0, 0, DateTimeKind.Utc));
            var unscheduled = await SeedSessionAsync(db, teamId, "Sin programar", null);

            await using var readDb = _fixture.CreateDbContext();
            var result = await new GetSessionsHandler(readDb).Handle(new GetSessionsQuery(teamId, userId, season.Id), CancellationToken.None);

            Assert.Equal(
                new[] { planned, freeInside, unscheduled }.OrderBy(id => id),
                result.Select(s => s.Id).OrderBy(id => id));
        }

        [Fact]
        public async Task Handle_WithoutSeasonId_ReturnsAllTeamSessions()
        {
            await using var db = _fixture.CreateDbContext();
            var (userId, clubId, teamId, _) = await SeedTeamAsync(db);
            var otherSeason = await SeedSeasonAsync(db, clubId, new DateTime(2025, 7, 1, 0, 0, 0, DateTimeKind.Utc), new DateTime(2026, 6, 30, 0, 0, 0, DateTimeKind.Utc));
            var otherMicrocicloId = await SeedMicrocicloAsync(db, teamId, otherSeason.Id);
            await SeedSessionAsync(db, teamId, "Plan otra temporada", new DateTime(2025, 9, 3, 0, 0, 0, DateTimeKind.Utc), otherMicrocicloId);
            await SeedSessionAsync(db, teamId, "Libre", new DateTime(2030, 1, 1, 0, 0, 0, DateTimeKind.Utc));
            await SeedSessionAsync(db, teamId, "Sin programar", null);

            await using var readDb = _fixture.CreateDbContext();
            var result = await new GetSessionsHandler(readDb).Handle(new GetSessionsQuery(teamId, userId), CancellationToken.None);

            Assert.Equal(3, result.Count());
        }

        [Fact]
        public async Task Handle_WithUnknownSeasonId_ThrowsSeasonNotFound()
        {
            await using var db = _fixture.CreateDbContext();
            var (userId, _, teamId, _) = await SeedTeamAsync(db);

            var ex = await Assert.ThrowsAsync<RFFM.Api.Domain.DomainException>(async () =>
                await new GetSessionsHandler(db).Handle(new GetSessionsQuery(teamId, userId, "missing-season"), CancellationToken.None));

            Assert.Equal(RFFM.Api.Domain.ErrorCodes.SeasonNotFound, ex.Code);
        }

        [Fact]
        public async Task Handle_PlannedSession_IncludesMicroMesoAndMacrociclo()
        {
            await using var db = _fixture.CreateDbContext();
            var (userId, _, teamId, seasonId) = await SeedTeamAsync(db);
            var microcicloId = await SeedMicrocicloAsync(db, teamId, seasonId);
            await SeedSessionAsync(db, teamId, "Plan", new DateTime(2026, 9, 2, 0, 0, 0, DateTimeKind.Utc), microcicloId);

            await using var readDb = _fixture.CreateDbContext();
            var item = Assert.Single(await new GetSessionsHandler(readDb).Handle(new GetSessionsQuery(teamId, userId), CancellationToken.None));

            Assert.Equal(1, item.MicrocicloOrder);
            Assert.Equal(new DateOnly(2026, 9, 1), item.MicrocicloStartDate);
            Assert.Equal(new DateOnly(2026, 9, 7), item.MicrocicloEndDate);
            Assert.Equal("Mesociclo 1.1", item.MesocicloName);
            Assert.Equal(1, item.MesocicloOrder);
            Assert.NotNull(item.MesocicloId);
            Assert.Equal("Macrociclo 1", item.MacrocicloName);
            Assert.Equal(1, item.MacrocicloOrder);
            Assert.NotNull(item.MacrocicloId);
        }
}
}
