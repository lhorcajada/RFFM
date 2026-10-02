#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.Training;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.PlayerTracking;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class SessionEvaluationHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public SessionEvaluationHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private sealed record Seed(
            string TeamId, string TeamPlayerId, string SessionId,
            string SubDirectId, string SubViaZonaId, string SubNotTrainedId);

        /// <summary>
        /// Modelo con tres subprincipios: uno con un sub-subprincipio directo y otro con uno dentro de una
        /// Zona (los dos trabajados en la sesión) y un tercero que la sesión no trabaja.
        /// </summary>
        private static async Task<Seed> SeedAsync(AppDbContext db, DateTime? sessionDate = null)
        {
            var (teamId, teamPlayerId, _) = await PlayerModelObservationPersistenceTests.SeedAsync(db);

            var model = new GameModel(teamId, "Modelo sesiones", "2026-2027");
            var principle = new GamePrinciple(model.Id, gameMomentId: 1, key: $"p-{Guid.NewGuid():N}", numero: 3, "Ataque posicional", "Texto");

            var direct = new Subprincipio(principle.Id, $"sd-{Guid.NewGuid():N}", "3.1", "Circular para desordenar", "Texto");
            var directSsp = new SubSubPrincipio($"ssp-{Guid.NewGuid():N}", "3.1.1", "Extremo: fijar por dentro", "Texto", direct.Id, null);
            direct.SubSubPrincipios.Add(directSsp);

            var viaZona = new Subprincipio(principle.Id, $"sz-{Guid.NewGuid():N}", "3.2", "Asegurar tras robo", "Texto");
            var zona = new Zona(viaZona.Id, $"z-{Guid.NewGuid():N}", "creacion-propia", null, null, "Texto");
            var zonaSsp = new SubSubPrincipio($"sspz-{Guid.NewGuid():N}", "3.2.1", "Todos: asegurar el pase", "Texto", null, zona.Id);
            zona.SubSubPrincipios.Add(zonaSsp);
            viaZona.Zonas.Add(zona);

            var notTrained = new Subprincipio(principle.Id, $"sn-{Guid.NewGuid():N}", "3.3", "Atacar el espacio", "Texto");

            principle.Subprincipios.Add(direct);
            principle.Subprincipios.Add(viaZona);
            principle.Subprincipios.Add(notTrained);
            model.Principles.Add(principle);
            db.GameModels.Add(model);
            await db.SaveChangesAsync();

            var session = new TrainingSession
            {
                TeamId = teamId,
                Name = "10. Desorganizar rival",
                Date = sessionDate ?? new DateTime(2026, 9, 14, 0, 0, 0, DateTimeKind.Utc)
            };
            session.ReplaceTargets(new[] { directSsp.Id, zonaSsp.Id });
            db.TrainingSessions.Add(session);
            await db.SaveChangesAsync();

            return new Seed(teamId, teamPlayerId, session.Id, direct.Id, viaZona.Id, notTrained.Id);
        }

        private static ICurrentUserService CurrentUser()
        {
            var mock = new Mock<ICurrentUserService>();
            mock.SetupGet(u => u.UserId).Returns("coach-1");
            return mock.Object;
        }

        private static SaveSessionEvaluation.EvaluationItem Item(string subprincipioId, string assessment = "NotAchieved", string? comment = null) =>
            new(subprincipioId, assessment, comment);

        private static Task<SaveSessionEvaluation.SessionEvaluationDto> SaveAsync(
            AppDbContext db, Seed seed, params SaveSessionEvaluation.EvaluationItem[] items) =>
            SaveAsync(db, seed.TeamId, seed.TeamPlayerId, seed.SessionId, items);

        private static Task<SaveSessionEvaluation.SessionEvaluationDto> SaveAsync(
            AppDbContext db, string teamId, string teamPlayerId, string sessionId, params SaveSessionEvaluation.EvaluationItem[] items) =>
            new SaveSessionEvaluation.Handler(db, CurrentUser())
                .Handle(new SaveSessionEvaluation.Command
                {
                    TeamId = teamId,
                    TeamPlayerId = teamPlayerId,
                    SessionId = sessionId,
                    Evaluations = items
                }, CancellationToken.None)
                .AsTask();

        private static Task<SaveSessionEvaluation.SessionEvaluationDto> GetAsync(AppDbContext db, Seed seed) =>
            new GetSessionEvaluation.Handler(db)
                .Handle(new GetSessionEvaluation.Query { TeamId = seed.TeamId, TeamPlayerId = seed.TeamPlayerId, SessionId = seed.SessionId },
                    CancellationToken.None)
                .AsTask();

        private static Task DeleteAsync(AppDbContext db, Seed seed) =>
            new DeleteSessionEvaluation.Handler(db)
                .Handle(new DeleteSessionEvaluation.Command { TeamId = seed.TeamId, TeamPlayerId = seed.TeamPlayerId, SessionId = seed.SessionId },
                    CancellationToken.None)
                .AsTask();

        [Fact]
        public async Task Save_CreatesTheEvaluationWithSessionAndSubprincipioLabels()
        {
            await using var db = _fixture.CreateDbContext();
            var seed = await SeedAsync(db);

            var result = await SaveAsync(db, seed,
                Item(seed.SubDirectId, "NotAchieved", "Busca el pase vertical"),
                Item(seed.SubViaZonaId, "Partial"));

            Assert.Equal(seed.SessionId, result.TrainingSessionId);
            Assert.Equal("10. Desorganizar rival", result.SessionName);
            Assert.Equal(new DateOnly(2026, 9, 14), result.SessionDate);
            Assert.Equal(2, result.Subprincipios.Count);
            var direct = result.Subprincipios.Single(s => s.SubprincipioId == seed.SubDirectId);
            Assert.Equal("3. Ataque posicional", direct.PrincipleLabel);
            Assert.Equal("3.1 Circular para desordenar", direct.SubprincipioLabel);
            Assert.Equal("NotAchieved", direct.Assessment);
            Assert.Equal("Busca el pase vertical", direct.Comment);
        }

        [Fact]
        public async Task Save_Again_ReplacesTheEvaluationOfThatSession()
        {
            await using var db = _fixture.CreateDbContext();
            var seed = await SeedAsync(db);
            await SaveAsync(db, seed, Item(seed.SubDirectId), Item(seed.SubViaZonaId));

            await using var secondDb = _fixture.CreateDbContext();
            var result = await SaveAsync(secondDb, seed, Item(seed.SubViaZonaId, "Achieved"));

            var item = Assert.Single(result.Subprincipios);
            Assert.Equal(seed.SubViaZonaId, item.SubprincipioId);
            Assert.Equal("Achieved", item.Assessment);
            await using var readDb = _fixture.CreateDbContext();
            Assert.Equal(1, await readDb.PlayerSessionEvaluations.CountAsync(e => e.TeamPlayerId == seed.TeamPlayerId));
            Assert.Equal(1, await readDb.SubprincipioEvaluations.CountAsync(s => s.PlayerSessionEvaluationId == result.Id));
        }

        [Fact]
        public async Task Save_SubprincipioNotTrainedInTheSession_ThrowsDomainException()
        {
            await using var db = _fixture.CreateDbContext();
            var seed = await SeedAsync(db);

            var ex = await Assert.ThrowsAsync<DomainException>(() => SaveAsync(db, seed, Item(seed.SubNotTrainedId)));

            Assert.Equal(ErrorCodes.SubprincipioNotInSession, ex.Code);
            Assert.False(await db.PlayerSessionEvaluations.AnyAsync(e => e.TeamPlayerId == seed.TeamPlayerId));
        }

        [Fact]
        public async Task Save_SessionOfAnotherTeam_ThrowsNotFound()
        {
            await using var db = _fixture.CreateDbContext();
            var seed = await SeedAsync(db);
            var other = await SeedAsync(db);

            var ex = await Assert.ThrowsAsync<NotFoundException>(() =>
                SaveAsync(db, seed.TeamId, seed.TeamPlayerId, other.SessionId, Item(other.SubDirectId)));

            Assert.Equal(ErrorCodes.SessionNotFound, ex.Code);
        }

        [Fact]
        public async Task Save_SessionNotHeldYet_ThrowsDomainException()
        {
            await using var db = _fixture.CreateDbContext();
            var seed = await SeedAsync(db, DateTime.UtcNow.Date.AddDays(3));

            var ex = await Assert.ThrowsAsync<DomainException>(() => SaveAsync(db, seed, Item(seed.SubDirectId)));

            Assert.Equal(ErrorCodes.SessionNotHeldYet, ex.Code);
        }

        [Fact]
        public async Task Get_ReturnsTheEvaluation_AndNotFoundWhenThereIsNone()
        {
            await using var db = _fixture.CreateDbContext();
            var seed = await SeedAsync(db);

            var missing = await Assert.ThrowsAsync<NotFoundException>(() => GetAsync(db, seed));
            Assert.Equal(ErrorCodes.SessionEvaluationNotFound, missing.Code);

            await SaveAsync(db, seed, Item(seed.SubDirectId, "Partial", "Mejora"));
            await using var readDb = _fixture.CreateDbContext();
            var result = await GetAsync(readDb, seed);

            var item = Assert.Single(result.Subprincipios);
            Assert.Equal("Partial", item.Assessment);
            Assert.Equal("Mejora", item.Comment);
        }

        [Fact]
        public async Task Delete_RemovesTheEvaluation_AndNotFoundWhenThereIsNone()
        {
            await using var db = _fixture.CreateDbContext();
            var seed = await SeedAsync(db);

            var missing = await Assert.ThrowsAsync<NotFoundException>(() => DeleteAsync(db, seed));
            Assert.Equal(ErrorCodes.SessionEvaluationNotFound, missing.Code);

            await SaveAsync(db, seed, Item(seed.SubDirectId));
            await using var deleteDb = _fixture.CreateDbContext();
            await DeleteAsync(deleteDb, seed);

            await using var readDb = _fixture.CreateDbContext();
            Assert.False(await readDb.PlayerSessionEvaluations.AnyAsync(e => e.TeamPlayerId == seed.TeamPlayerId));
        }
    }
}
