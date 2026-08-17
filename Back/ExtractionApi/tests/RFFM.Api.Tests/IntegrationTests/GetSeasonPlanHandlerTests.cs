#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.SeasonPlans;
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
    /// including the per-Microciclo ExerciseCount projection that powers the coverage view.
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
            var microciclo = new Microciclo(mesociclo.Id, 1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "Obj A", "Obj B");
            mesociclo.Microciclos.Add(microciclo);
            macrociclo.Mesociclos.Add(mesociclo);
            plan.Macrociclos.Add(macrociclo);
            db.SeasonPlans.Add(plan);
            await db.SaveChangesAsync();

            return (userId, club.Id, team.Id, season.Id, microciclo.Id);
        }

        private async Task<(string SubprincipioId, string SubSubPrincipioId, string GameMomentName, string Numero, string Titulo, string Rol)> SeedAdnNodesAsync(AppDbContext db, string teamId)
        {
            var gameMoment = await db.GameMoments.AsNoTracking().FirstAsync();

            var model = new GameModel(teamId, "Modelo de prueba", "2026-2027");
            var principle = new GamePrinciple(model.Id, gameMoment.Id, key: $"principio-{Guid.NewGuid():N}", numero: 1, "Principio", "Texto");
            var subprincipio = new Subprincipio(principle.Id, $"sub-{Guid.NewGuid():N}", "1.1", "Defensa organizada 1.1", "Contexto");
            var subSubPrincipio = new SubSubPrincipio($"subsub-{Guid.NewGuid():N}", "1.1.1", "Central", "Texto", subprincipio.Id, null);

            principle.Subprincipios.Add(subprincipio);
            subprincipio.SubSubPrincipios.Add(subSubPrincipio);
            model.Principles.Add(principle);

            db.GameModels.Add(model);
            await db.SaveChangesAsync();

            return (subprincipio.Id, subSubPrincipio.Id, gameMoment.Name, subprincipio.Numero, subprincipio.Titulo, subSubPrincipio.Rol);
        }

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
        public async Task Handle_MicrocicloWithLinkedExercises_ProjectsExerciseCount()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, clubId, teamId, seasonId, microcicloId) = await SeedPlanAsync(seedDb);

            seedDb.TaskTrainingBases.AddRange(
                new TaskTrainingBase { Name = "Ej 1", Description = "D", ClubId = clubId, FieldSpace = "F", MicrocicloId = microcicloId },
                new TaskTrainingBase { Name = "Ej 2", Description = "D", ClubId = clubId, FieldSpace = "F", MicrocicloId = microcicloId },
                new TaskTrainingBase { Name = "Ej sin vincular", Description = "D", ClubId = clubId, FieldSpace = "F", MicrocicloId = null });
            await seedDb.SaveChangesAsync();

            await using var db = _fixture.CreateDbContext();
            var handler = new GetSeasonPlanFeature.Handler(db);

            var result = await handler.Handle(new GetSeasonPlanFeature.SeasonPlanQuery(teamId, seasonId, userId), CancellationToken.None);

            var microciclo = result!.Macrociclos.Single().Mesociclos.Single().Microciclos.Single();
            Assert.Equal(2, microciclo.ExerciseCount);
        }

        [Fact]
        public async Task Handle_MicrocicloWithNoLinkedExercises_ProjectsZero()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, teamId, seasonId, _) = await SeedPlanAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetSeasonPlanFeature.Handler(db);

            var result = await handler.Handle(new GetSeasonPlanFeature.SeasonPlanQuery(teamId, seasonId, userId), CancellationToken.None);

            var microciclo = result!.Macrociclos.Single().Mesociclos.Single().Microciclos.Single();
            Assert.Equal(0, microciclo.ExerciseCount);
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
        public async Task Handle_MicrocicloWithSesionAdnLinks_ResolvesDenormalizedSummaries()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, teamId, seasonId, microcicloId) = await SeedPlanAsync(seedDb);
            var (subprincipioId, subSubPrincipioId, gameMomentName, numero, titulo, rol) = await SeedAdnNodesAsync(seedDb, teamId);

            await using var linkDb = _fixture.CreateDbContext();
            var microciclo = await linkDb.Microciclos.SingleAsync(m => m.Id == microcicloId);
            microciclo.ReplaceSubprincipioLinks(Microciclo.SessionA, new List<string> { subprincipioId });
            microciclo.ReplaceSubSubPrincipioLinks(Microciclo.SessionA, new List<string> { subSubPrincipioId });
            microciclo.UpdateSesionAHabilidades(new List<string> { "Pase" });
            await linkDb.SaveChangesAsync();

            await using var db = _fixture.CreateDbContext();
            var handler = new GetSeasonPlanFeature.Handler(db);

            var result = await handler.Handle(new GetSeasonPlanFeature.SeasonPlanQuery(teamId, seasonId, userId), CancellationToken.None);

            var microcicloResponse = result!.Macrociclos.Single().Mesociclos.Single().Microciclos.Single();
            var subprincipioSummary = Assert.Single(microcicloResponse.SesionASubprincipios);
            Assert.Equal(subprincipioId, subprincipioSummary.Id);
            Assert.Equal(numero, subprincipioSummary.Numero);
            Assert.Equal(titulo, subprincipioSummary.Titulo);
            Assert.Equal(gameMomentName, subprincipioSummary.GameMomentName);

            var subSubPrincipioSummary = Assert.Single(microcicloResponse.SesionASubSubPrincipios);
            Assert.Equal(subSubPrincipioId, subSubPrincipioSummary.Id);
            Assert.Equal(rol, subSubPrincipioSummary.Rol);

            Assert.Equal(new List<string> { "Pase" }, microcicloResponse.SesionAHabilidades);
            Assert.Empty(microcicloResponse.SesionBSubprincipios);
            Assert.Empty(microcicloResponse.SesionBSubSubPrincipios);
            Assert.Empty(microcicloResponse.SesionBHabilidades);
        }

        [Fact]
        public async Task Handle_MicrocicloWithNoSesionAdnLinks_ReturnsEmptySummariesNotNull()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, teamId, seasonId, _) = await SeedPlanAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetSeasonPlanFeature.Handler(db);

            var result = await handler.Handle(new GetSeasonPlanFeature.SeasonPlanQuery(teamId, seasonId, userId), CancellationToken.None);

            var microcicloResponse = result!.Macrociclos.Single().Mesociclos.Single().Microciclos.Single();
            Assert.NotNull(microcicloResponse.SesionASubprincipios);
            Assert.Empty(microcicloResponse.SesionASubprincipios);
            Assert.NotNull(microcicloResponse.SesionASubSubPrincipios);
            Assert.Empty(microcicloResponse.SesionASubSubPrincipios);
            Assert.NotNull(microcicloResponse.SesionAHabilidades);
            Assert.Empty(microcicloResponse.SesionAHabilidades);
        }
    }
}
