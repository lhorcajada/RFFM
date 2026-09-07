#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.SeasonPlans;
using RFFM.Api.Domain.Aggregates.Training;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using GetSeasonPlanFeature = RFFM.Api.Features.Coaches.SeasonPlans.Queries.GetSeasonPlan;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Integration tests for GET /api/season-plans (<see cref="GetSeasonPlanFeature.SeasonPlanQuery"/>),
    /// including the per-Microciclo linked-session summary that powers the coverage view.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class GetSeasonPlanHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetSeasonPlanHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string UserId, string ClubId, string TeamId, string SeasonId, string MicrocicloId)> SeedPlanAsync(AppDbContext db)
        {
            var club = Club.Create($"GetSeasonPlan Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}",
                DateTime.UtcNow,
                DateTime.UtcNow.AddMonths(9),
                isActive: true,
                club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "GetSeasonPlan Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var plan = new SeasonPlan(team.Id, season.Id);
            var macrociclo = new Macrociclo(plan.Id, 1, "Macrociclo 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21));
            var mesociclo = new Mesociclo(macrociclo.Id, 1, "Mesociclo 1.1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21), 2);
            var microciclo = new Microciclo(mesociclo.Id, 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7));
            mesociclo.Microciclos.Add(microciclo);
            macrociclo.Mesociclos.Add(mesociclo);
            plan.Macrociclos.Add(macrociclo);
            db.SeasonPlans.Add(plan);
            await db.SaveChangesAsync();

            return (userId, club.Id, team.Id, season.Id, microciclo.Id);
        }

        private static async Task<(string SubprincipioId, string SubSubPrincipioId, string Numero, string Titulo, string GameMomentName)> SeedSubprincipioAsync(AppDbContext db, string teamId)
        {
            var gameMoment = await db.GameMoments.AsNoTracking().FirstAsync();
            var model = new GameModel(teamId, "Modelo de prueba", "2026-2027");
            var principle = new GamePrinciple(model.Id, gameMoment.Id, key: $"principio-{Guid.NewGuid():N}", numero: 1, "Principio", "Texto");
            var subprincipio = new Subprincipio(principle.Id, $"sub-{Guid.NewGuid():N}", "1.1", "Subprincipio objetivo", "Contexto");
            var subSubPrincipio = new SubSubPrincipio($"ssp-{Guid.NewGuid():N}", "1.1.1", "Rol", "Texto", subprincipio.Id, null);
            subprincipio.SubSubPrincipios.Add(subSubPrincipio);
            principle.Subprincipios.Add(subprincipio);
            model.Principles.Add(principle);
            db.GameModels.Add(model);
            await db.SaveChangesAsync();
            return (subprincipio.Id, subSubPrincipio.Id, subprincipio.Numero, subprincipio.Titulo, gameMoment.Name);
        }

        private static TaskTrainingBase NewExercise(string clubId, string name) => new()
        {
            Name = name, Tipo = "Analitico", Objetivo = "O", Logistica = "L", Descripcion = "D", ClubId = clubId,
        };

        [Fact]
        public async Task Handle_ExistingPlan_ReturnsFullTree()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, teamId, seasonId, _) = await SeedPlanAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetSeasonPlanFeature.Handler(db);

            var result = await handler.Handle(new GetSeasonPlanFeature.SeasonPlanQuery(teamId, seasonId, userId), CancellationToken.None);

            Assert.NotNull(result);
            var macrociclo = Assert.Single(result!.Macrociclos);
            var mesociclo = Assert.Single(macrociclo.Mesociclos);
            var microciclo = Assert.Single(mesociclo.Microciclos);
            Assert.Equal("Semana 1", microciclo.WeekLabel);
            Assert.Empty(microciclo.Sessions);
        }

        [Fact]
        public async Task Handle_NoPlanForTeamAndSeason_ReturnsNull()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, teamId, _, _) = await SeedPlanAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetSeasonPlanFeature.Handler(db);

            var result = await handler.Handle(
                new GetSeasonPlanFeature.SeasonPlanQuery(teamId, $"missing-season-{Guid.NewGuid():N}", userId),
                CancellationToken.None);

            Assert.Null(result);
        }

        [Fact]
        public async Task Handle_MicrocicloWithLinkedSession_ProjectsSessionSummary()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, teamId, seasonId, microcicloId) = await SeedPlanAsync(seedDb);

            var exercise1 = NewExercise(clubId, "Ej 1");
            var exercise2 = NewExercise(clubId, "Ej 2");
            seedDb.TaskTrainingBases.AddRange(exercise1, exercise2);
            await seedDb.SaveChangesAsync();

            var session = new TrainingSession
            {
                Name = "Sesion 1", TeamId = teamId, Date = DateTime.UtcNow, MicrocicloId = microcicloId,
                ObjetivoGeneral = "Objetivo de la sesion",
            };
            var block = new SessionBlock(session.Id, 1, "Bloque 1", "Primer bloque.", null);
            block.ReplaceExercises(new[] { (exercise1.Id, 1), (exercise2.Id, 2) });
            session.Blocks.Add(block);
            seedDb.TrainingSessions.Add(session);
            await seedDb.SaveChangesAsync();

            await using var db = _fixture.CreateDbContext();
            var handler = new GetSeasonPlanFeature.Handler(db);

            var result = await handler.Handle(new GetSeasonPlanFeature.SeasonPlanQuery(teamId, seasonId, userId), CancellationToken.None);

            var microciclo = result!.Macrociclos.Single().Mesociclos.Single().Microciclos.Single();
            var sessionSummary = Assert.Single(microciclo.Sessions);
            Assert.Equal(session.Id, sessionSummary.Id);
            Assert.Equal("Objetivo de la sesion", sessionSummary.ObjetivoGeneral);
            Assert.Equal(2, sessionSummary.ExerciseCount);
        }

        [Fact]
        public async Task Handle_MicrocicloWithNoLinkedSessions_ProjectsEmptySessions()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, teamId, seasonId, _) = await SeedPlanAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetSeasonPlanFeature.Handler(db);

            var result = await handler.Handle(new GetSeasonPlanFeature.SeasonPlanQuery(teamId, seasonId, userId), CancellationToken.None);

            var microciclo = result!.Macrociclos.Single().Mesociclos.Single().Microciclos.Single();
            Assert.Empty(microciclo.Sessions);
        }

        [Fact]
        public async Task Handle_UserWithoutAccess_ThrowsTeamAccessDenied()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (_, _, teamId, seasonId, _) = await SeedPlanAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetSeasonPlanFeature.Handler(db);

            var ex = await Assert.ThrowsAsync<DomainException>(() =>
                handler.Handle(new GetSeasonPlanFeature.SeasonPlanQuery(teamId, seasonId, $"stranger-{Guid.NewGuid():N}"), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.TeamAccessDenied, ex.Code);
        }

        [Fact]
        public async Task Handle_DatedSessionWithTargetInsideMicrocicloRange_ResolvesWeeklyObjective()
        {
            // design.md Decision 4 of `season-plan-content-board`: the weekly objective is
            // derived from every dated TrainingSession's Targets whose Date falls inside the
            // Microciclo's [StartDate, EndDate] range — no longer a coach-editable field.
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, teamId, seasonId, microcicloId) = await SeedPlanAsync(seedDb);
            var (subprincipioId, subSubPrincipioId, _, titulo, gameMomentName) = await SeedSubprincipioAsync(seedDb, teamId);

            var session = new TrainingSession
            {
                Name = "Sesion con objetivo", TeamId = teamId, Date = new DateTime(2026, 9, 3, 0, 0, 0, DateTimeKind.Utc), MicrocicloId = microcicloId,
            };
            session.ReplaceTargets(new List<string> { subSubPrincipioId });
            seedDb.TrainingSessions.Add(session);
            await seedDb.SaveChangesAsync();

            await using var db = _fixture.CreateDbContext();
            var handler = new GetSeasonPlanFeature.Handler(db);

            var result = await handler.Handle(new GetSeasonPlanFeature.SeasonPlanQuery(teamId, seasonId, userId), CancellationToken.None);

            var microcicloResponse = result!.Macrociclos.Single().Mesociclos.Single().Microciclos.Single();
            var target = Assert.Single(microcicloResponse.WeeklyObjective);
            Assert.Equal(subSubPrincipioId, target.SubSubPrincipioId);
            Assert.Equal(subprincipioId, target.SubprincipioId);
            Assert.Equal("1.1.1", target.Numero);
            Assert.Equal(titulo, target.SubprincipioTitulo);
            Assert.Equal(gameMomentName, target.GameMomentName);
        }

        [Fact]
        public async Task Handle_MicrocicloWithNoSessionTargets_ReturnsEmptyWeeklyObjective()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, teamId, seasonId, _) = await SeedPlanAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetSeasonPlanFeature.Handler(db);

            var result = await handler.Handle(new GetSeasonPlanFeature.SeasonPlanQuery(teamId, seasonId, userId), CancellationToken.None);

            var microcicloResponse = result!.Macrociclos.Single().Mesociclos.Single().Microciclos.Single();
            Assert.NotNull(microcicloResponse.WeeklyObjective);
            Assert.Empty(microcicloResponse.WeeklyObjective);
        }

        [Fact]
        public async Task Handle_UnscheduledSessionWithTarget_DoesNotAttachToAnyWeek()
        {
            // An unscheduled session's targets never attach to a specific week — only dated
            // sessions feed the weekly objective (design.md Decision 4).
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, teamId, seasonId, microcicloId) = await SeedPlanAsync(seedDb);
            var (_, subSubPrincipioId, _, _, _) = await SeedSubprincipioAsync(seedDb, teamId);

            var session = new TrainingSession { Name = "Sesion sin fecha", TeamId = teamId, Date = null, MicrocicloId = null };
            session.ReplaceTargets(new List<string> { subSubPrincipioId });
            seedDb.TrainingSessions.Add(session);
            await seedDb.SaveChangesAsync();

            await using var db = _fixture.CreateDbContext();
            var handler = new GetSeasonPlanFeature.Handler(db);

            var result = await handler.Handle(new GetSeasonPlanFeature.SeasonPlanQuery(teamId, seasonId, userId), CancellationToken.None);

            var microcicloResponse = result!.Macrociclos.Single().Mesociclos.Single().Microciclos.Single();
            Assert.Empty(microcicloResponse.WeeklyObjective);
        }
    }
}
