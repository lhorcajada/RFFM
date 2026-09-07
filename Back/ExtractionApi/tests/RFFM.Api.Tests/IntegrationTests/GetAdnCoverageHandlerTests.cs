#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.GameModels.Queries;
using RFFM.Api.Features.Coaches.Trainings.Sessions;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using GetAdnCoverageFeature = RFFM.Api.Features.Coaches.GameModels.Queries.GetAdnCoverage;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Integration tests for GET /api/game-models/adn-coverage
    /// (<see cref="GetAdnCoverageFeature.AdnCoverageQuery"/>), design.md Decision 5 of
    /// `season-plan-content-board`.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class GetAdnCoverageHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetAdnCoverageHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string UserId, string TeamId, string Season)> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"AdnCoverage Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "AdnCoverage Test Team", CategoryId = Category.NationalCategory.Id, ClubId = club.Id, SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            return (userId, team.Id, "2026-2027");
        }

        /// <summary>One Principio, one Subprincipio, two direct SubSubPrincipios (no Zonas).</summary>
        private static async Task<(string PrincipioId, string SubprincipioId, string Ssp1, string Ssp2)> SeedGameModelAsync(
            AppDbContext db, string teamId, string season)
        {
            var model = new GameModel(teamId, "Modelo de prueba", season);
            var principle = new GamePrinciple(model.Id, gameMomentId: 1, key: $"principio-{Guid.NewGuid():N}", numero: 1, "Principio", "Texto");
            var subprincipio = new Subprincipio(principle.Id, $"sub-{Guid.NewGuid():N}", "1.1", "Subprincipio", "Contexto");
            var ssp1 = new SubSubPrincipio($"ssp1-{Guid.NewGuid():N}", "1.1.1", "Rol 1", "Texto", subprincipio.Id, null);
            var ssp2 = new SubSubPrincipio($"ssp2-{Guid.NewGuid():N}", "1.1.2", "Rol 2", "Texto", subprincipio.Id, null);
            subprincipio.SubSubPrincipios.Add(ssp1);
            subprincipio.SubSubPrincipios.Add(ssp2);
            principle.Subprincipios.Add(subprincipio);
            model.Principles.Add(principle);
            db.GameModels.Add(model);
            await db.SaveChangesAsync();
            return (principle.Id, subprincipio.Id, ssp1.Id, ssp2.Id);
        }

        /// <summary>
        /// One Principio, one Subprincipio with two Zonas, each having two direct
        /// SubSubPrincipios.
        /// </summary>
        private static async Task<(string PrincipioId, string SubprincipioId, string ZonaAId, string ZonaBId,
            string ZonaASsp1, string ZonaASsp2, string ZonaBSsp1, string ZonaBSsp2)> SeedGameModelWithZonasAsync(
            AppDbContext db, string teamId, string season)
        {
            var model = new GameModel(teamId, "Modelo de prueba con zonas", season);
            var principle = new GamePrinciple(model.Id, gameMomentId: 1, key: $"principio-{Guid.NewGuid():N}", numero: 1, "Principio", "Texto");
            var subprincipio = new Subprincipio(principle.Id, $"sub-{Guid.NewGuid():N}", "1.1", "Subprincipio", "Contexto");

            var zonaA = new Zona(subprincipio.Id, $"zona-a-{Guid.NewGuid():N}", "iniciacion", null, null, "Zona A");
            var zonaASsp1 = new SubSubPrincipio($"za-ssp1-{Guid.NewGuid():N}", "1.1.1", "Rol 1", "Texto", null, zonaA.Id);
            var zonaASsp2 = new SubSubPrincipio($"za-ssp2-{Guid.NewGuid():N}", "1.1.2", "Rol 2", "Texto", null, zonaA.Id);
            zonaA.SubSubPrincipios.Add(zonaASsp1);
            zonaA.SubSubPrincipios.Add(zonaASsp2);

            var zonaB = new Zona(subprincipio.Id, $"zona-b-{Guid.NewGuid():N}", "finalizacion", null, null, "Zona B");
            var zonaBSsp1 = new SubSubPrincipio($"zb-ssp1-{Guid.NewGuid():N}", "1.1.3", "Rol 3", "Texto", null, zonaB.Id);
            var zonaBSsp2 = new SubSubPrincipio($"zb-ssp2-{Guid.NewGuid():N}", "1.1.4", "Rol 4", "Texto", null, zonaB.Id);
            zonaB.SubSubPrincipios.Add(zonaBSsp1);
            zonaB.SubSubPrincipios.Add(zonaBSsp2);

            subprincipio.Zonas.Add(zonaA);
            subprincipio.Zonas.Add(zonaB);
            principle.Subprincipios.Add(subprincipio);
            model.Principles.Add(principle);
            db.GameModels.Add(model);
            await db.SaveChangesAsync();

            return (principle.Id, subprincipio.Id, zonaA.Id, zonaB.Id, zonaASsp1.Id, zonaASsp2.Id, zonaBSsp1.Id, zonaBSsp2.Id);
        }

        private static async Task CreateSessionTargetingAsync(AppDbContext db, string teamId, string userId, params string[] sspIds)
        {
            var command = new CreateSessionCommand(
                teamId, "Sesion", null, null, null, null, null, null, null, null, null,
                new List<SessionBlockRequest>(), sspIds.ToList())
            { UserId = userId };
            await new CreateSessionHandler(db).Handle(command, CancellationToken.None);
        }

        [Fact]
        public async Task Handle_NoTargetingSessions_AllNotStarted()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId, season) = await SeedTeamAsync(seedDb);
            var (principioId, subprincipioId, ssp1, ssp2) = await SeedGameModelAsync(seedDb, teamId, season);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetAdnCoverageFeature.Handler(db);

            var result = await handler.Handle(new GetAdnCoverageFeature.AdnCoverageQuery(teamId, season, userId), CancellationToken.None);

            Assert.NotNull(result);
            Assert.All(result!.SubSubPrincipios, s => Assert.False(s.IsUsed));
            Assert.All(result.Subprincipios, s => Assert.Equal(GetAdnCoverageFeature.AdnCoverageStatuses.NotStarted, s.Status));
            Assert.All(result.Principios, p => Assert.Equal(GetAdnCoverageFeature.AdnCoverageStatuses.NotStarted, p.Status));
            Assert.Contains(result.SubSubPrincipios, s => s.SubSubPrincipioId == ssp1);
            Assert.Contains(result.SubSubPrincipios, s => s.SubSubPrincipioId == ssp2);
            Assert.Contains(result.Subprincipios, s => s.SubprincipioId == subprincipioId);
            Assert.Contains(result.Principios, p => p.PrincipioId == principioId);
        }

        [Fact]
        public async Task Handle_AllSubSubPrincipiosTargeted_SubprincipioAndPrincipioCompleted()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId, season) = await SeedTeamAsync(seedDb);
            var (principioId, subprincipioId, ssp1, ssp2) = await SeedGameModelAsync(seedDb, teamId, season);

            await using var createDb = _fixture.CreateDbContext();
            await CreateSessionTargetingAsync(createDb, teamId, userId, ssp1, ssp2);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetAdnCoverageFeature.Handler(db);
            var result = await handler.Handle(new GetAdnCoverageFeature.AdnCoverageQuery(teamId, season, userId), CancellationToken.None);

            Assert.All(result!.SubSubPrincipios, s => Assert.True(s.IsUsed));
            Assert.Equal(GetAdnCoverageFeature.AdnCoverageStatuses.Completed, result.Subprincipios.Single(s => s.SubprincipioId == subprincipioId).Status);
            Assert.Equal(GetAdnCoverageFeature.AdnCoverageStatuses.Completed, result.Principios.Single(p => p.PrincipioId == principioId).Status);
        }

        [Fact]
        public async Task Handle_OnlyOneOfTwoSubSubPrincipiosTargeted_SubprincipioInProgress()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId, season) = await SeedTeamAsync(seedDb);
            var (_, subprincipioId, ssp1, _) = await SeedGameModelAsync(seedDb, teamId, season);

            await using var createDb = _fixture.CreateDbContext();
            await CreateSessionTargetingAsync(createDb, teamId, userId, ssp1);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetAdnCoverageFeature.Handler(db);
            var result = await handler.Handle(new GetAdnCoverageFeature.AdnCoverageQuery(teamId, season, userId), CancellationToken.None);

            Assert.Equal(GetAdnCoverageFeature.AdnCoverageStatuses.InProgress, result!.Subprincipios.Single(s => s.SubprincipioId == subprincipioId).Status);
        }

        [Fact]
        public async Task Handle_ZonaAllSubSubPrincipiosTargeted_ZonaCompleted()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId, season) = await SeedTeamAsync(seedDb);
            var (_, _, zonaAId, _, zonaASsp1, zonaASsp2, _, _) = await SeedGameModelWithZonasAsync(seedDb, teamId, season);

            await using var createDb = _fixture.CreateDbContext();
            await CreateSessionTargetingAsync(createDb, teamId, userId, zonaASsp1, zonaASsp2);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetAdnCoverageFeature.Handler(db);
            var result = await handler.Handle(new GetAdnCoverageFeature.AdnCoverageQuery(teamId, season, userId), CancellationToken.None);

            Assert.Equal(GetAdnCoverageFeature.AdnCoverageStatuses.Completed, result!.Zonas.Single(z => z.ZonaId == zonaAId).Status);
        }

        [Fact]
        public async Task Handle_ZonaOnlyOneOfTwoSubSubPrincipiosTargeted_ZonaInProgress()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId, season) = await SeedTeamAsync(seedDb);
            var (_, _, zonaAId, _, zonaASsp1, _, _, _) = await SeedGameModelWithZonasAsync(seedDb, teamId, season);

            await using var createDb = _fixture.CreateDbContext();
            await CreateSessionTargetingAsync(createDb, teamId, userId, zonaASsp1);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetAdnCoverageFeature.Handler(db);
            var result = await handler.Handle(new GetAdnCoverageFeature.AdnCoverageQuery(teamId, season, userId), CancellationToken.None);

            Assert.Equal(GetAdnCoverageFeature.AdnCoverageStatuses.InProgress, result!.Zonas.Single(z => z.ZonaId == zonaAId).Status);
        }

        [Fact]
        public async Task Handle_ZonaNoneTargeted_ZonaNotStarted()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId, season) = await SeedTeamAsync(seedDb);
            var (_, _, zonaAId, _, _, _, _, _) = await SeedGameModelWithZonasAsync(seedDb, teamId, season);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetAdnCoverageFeature.Handler(db);
            var result = await handler.Handle(new GetAdnCoverageFeature.AdnCoverageQuery(teamId, season, userId), CancellationToken.None);

            Assert.Equal(GetAdnCoverageFeature.AdnCoverageStatuses.NotStarted, result!.Zonas.Single(z => z.ZonaId == zonaAId).Status);
        }

        [Fact]
        public async Task Handle_SubprincipioWithZonas_OnlyCompletedWhenAllZonasCompleted()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId, season) = await SeedTeamAsync(seedDb);
            var (_, subprincipioId, _, _, zonaASsp1, zonaASsp2, _, _) = await SeedGameModelWithZonasAsync(seedDb, teamId, season);

            // Zona A fully targeted (completed), Zona B untouched (not-started) -> Subprincipio is in-progress, not completed.
            await using var createDb = _fixture.CreateDbContext();
            await CreateSessionTargetingAsync(createDb, teamId, userId, zonaASsp1, zonaASsp2);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetAdnCoverageFeature.Handler(db);
            var result = await handler.Handle(new GetAdnCoverageFeature.AdnCoverageQuery(teamId, season, userId), CancellationToken.None);

            Assert.Equal(GetAdnCoverageFeature.AdnCoverageStatuses.InProgress, result!.Subprincipios.Single(s => s.SubprincipioId == subprincipioId).Status);
        }

        [Fact]
        public async Task Handle_SubprincipioWithZonas_InProgressWhenAtLeastOneZonaHasProgress()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId, season) = await SeedTeamAsync(seedDb);
            var (_, subprincipioId, _, _, zonaASsp1, _, _, _) = await SeedGameModelWithZonasAsync(seedDb, teamId, season);

            await using var createDb = _fixture.CreateDbContext();
            await CreateSessionTargetingAsync(createDb, teamId, userId, zonaASsp1);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetAdnCoverageFeature.Handler(db);
            var result = await handler.Handle(new GetAdnCoverageFeature.AdnCoverageQuery(teamId, season, userId), CancellationToken.None);

            Assert.Equal(GetAdnCoverageFeature.AdnCoverageStatuses.InProgress, result!.Subprincipios.Single(s => s.SubprincipioId == subprincipioId).Status);
        }

        [Fact]
        public async Task Handle_SubprincipioWithZonas_CompletedWhenAllZonasCompleted()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId, season) = await SeedTeamAsync(seedDb);
            var (_, subprincipioId, _, _, zonaASsp1, zonaASsp2, zonaBSsp1, zonaBSsp2) = await SeedGameModelWithZonasAsync(seedDb, teamId, season);

            await using var createDb = _fixture.CreateDbContext();
            await CreateSessionTargetingAsync(createDb, teamId, userId, zonaASsp1, zonaASsp2, zonaBSsp1, zonaBSsp2);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetAdnCoverageFeature.Handler(db);
            var result = await handler.Handle(new GetAdnCoverageFeature.AdnCoverageQuery(teamId, season, userId), CancellationToken.None);

            Assert.Equal(GetAdnCoverageFeature.AdnCoverageStatuses.Completed, result!.Subprincipios.Single(s => s.SubprincipioId == subprincipioId).Status);
        }

        [Fact]
        public async Task Handle_PrincipioAggregatesSubprincipiosStatuses_InProgressWhenMixed()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId, season) = await SeedTeamAsync(seedDb);

            var model = new GameModel(teamId, "Modelo con dos subprincipios", season);
            var principle = new GamePrinciple(model.Id, gameMomentId: 1, key: $"principio-{Guid.NewGuid():N}", numero: 1, "Principio", "Texto");
            var subA = new Subprincipio(principle.Id, $"sub-a-{Guid.NewGuid():N}", "1.1", "Subprincipio A", "Contexto");
            var subASsp = new SubSubPrincipio($"a-ssp-{Guid.NewGuid():N}", "1.1.1", "Rol", "Texto", subA.Id, null);
            subA.SubSubPrincipios.Add(subASsp);
            var subB = new Subprincipio(principle.Id, $"sub-b-{Guid.NewGuid():N}", "1.2", "Subprincipio B", "Contexto");
            var subBSsp = new SubSubPrincipio($"b-ssp-{Guid.NewGuid():N}", "1.2.1", "Rol", "Texto", subB.Id, null);
            subB.SubSubPrincipios.Add(subBSsp);
            principle.Subprincipios.Add(subA);
            principle.Subprincipios.Add(subB);
            model.Principles.Add(principle);
            seedDb.GameModels.Add(model);
            await seedDb.SaveChangesAsync();

            // Only subA is completed; subB is not-started -> Principio is in-progress.
            await using var createDb = _fixture.CreateDbContext();
            await CreateSessionTargetingAsync(createDb, teamId, userId, subASsp.Id);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetAdnCoverageFeature.Handler(db);
            var result = await handler.Handle(new GetAdnCoverageFeature.AdnCoverageQuery(teamId, season, userId), CancellationToken.None);

            Assert.Equal(GetAdnCoverageFeature.AdnCoverageStatuses.Completed, result!.Subprincipios.Single(s => s.SubprincipioId == subA.Id).Status);
            Assert.Equal(GetAdnCoverageFeature.AdnCoverageStatuses.NotStarted, result.Subprincipios.Single(s => s.SubprincipioId == subB.Id).Status);
            Assert.Equal(GetAdnCoverageFeature.AdnCoverageStatuses.InProgress, result.Principios.Single(p => p.PrincipioId == principle.Id).Status);
        }

        [Fact]
        public async Task Handle_PrincipioAllSubprincipiosCompleted_PrincipioCompleted()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId, season) = await SeedTeamAsync(seedDb);
            var (principioId, _, ssp1, ssp2) = await SeedGameModelAsync(seedDb, teamId, season);

            await using var createDb = _fixture.CreateDbContext();
            await CreateSessionTargetingAsync(createDb, teamId, userId, ssp1, ssp2);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetAdnCoverageFeature.Handler(db);
            var result = await handler.Handle(new GetAdnCoverageFeature.AdnCoverageQuery(teamId, season, userId), CancellationToken.None);

            Assert.Equal(GetAdnCoverageFeature.AdnCoverageStatuses.Completed, result!.Principios.Single(p => p.PrincipioId == principioId).Status);
        }

        [Fact]
        public async Task Handle_PrincipioNoTargets_PrincipioNotStarted()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId, season) = await SeedTeamAsync(seedDb);
            var (principioId, _, _, _) = await SeedGameModelAsync(seedDb, teamId, season);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetAdnCoverageFeature.Handler(db);
            var result = await handler.Handle(new GetAdnCoverageFeature.AdnCoverageQuery(teamId, season, userId), CancellationToken.None);

            Assert.Equal(GetAdnCoverageFeature.AdnCoverageStatuses.NotStarted, result!.Principios.Single(p => p.PrincipioId == principioId).Status);
        }

        [Fact]
        public async Task Handle_UnscheduledSessionTarget_StillCountsAsUsage()
        {
            // "covered" counts scheduled AND unscheduled sessions — distinct from the season
            // plan's weekly objective, which only derives from dated sessions (design.md
            // Decision 4/5).
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId, season) = await SeedTeamAsync(seedDb);
            var (_, _, ssp1, _) = await SeedGameModelAsync(seedDb, teamId, season);

            await using var createDb = _fixture.CreateDbContext();
            var command = new CreateSessionCommand(
                teamId, "Sesion sin fecha", null, null, null, null, null, null, null, null, null,
                new List<SessionBlockRequest>(), new List<string> { ssp1 })
            { UserId = userId };
            await new CreateSessionHandler(createDb).Handle(command, CancellationToken.None);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetAdnCoverageFeature.Handler(db);
            var result = await handler.Handle(new GetAdnCoverageFeature.AdnCoverageQuery(teamId, season, userId), CancellationToken.None);

            var coverage = result!.SubSubPrincipios.Single(s => s.SubSubPrincipioId == ssp1);
            Assert.True(coverage.IsUsed);
            var usage = Assert.Single(coverage.Sessions);
            Assert.Null(usage.Date);
        }

        [Fact]
        public async Task Handle_NoGameModelForTeamAndSeason_ReturnsNull()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId, season) = await SeedTeamAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetAdnCoverageFeature.Handler(db);

            var result = await handler.Handle(new GetAdnCoverageFeature.AdnCoverageQuery(teamId, season, userId), CancellationToken.None);

            Assert.Null(result);
        }

        [Fact]
        public async Task Handle_UserWithoutAccess_ThrowsTeamAccessDenied()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (_, teamId, season) = await SeedTeamAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetAdnCoverageFeature.Handler(db);

            var ex = await Assert.ThrowsAsync<DomainException>(() =>
                handler.Handle(new GetAdnCoverageFeature.AdnCoverageQuery(teamId, season, $"stranger-{Guid.NewGuid():N}"), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.TeamAccessDenied, ex.Code);
        }
    }
}
