#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.GameModels.Commands;
using RFFM.Api.Features.Coaches.GameModels.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Integration tests for PUT /api/game-models/{id} (<see cref="UpdateGameModelCommand"/>),
    /// covering create/update/delete of principles and their nested subprincipios.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class UpdateGameModelHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UpdateGameModelHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static List<SetPieceRuleRequest> NoRules => new();
        private static List<OpenIssueRequest> NoIssues => new();
        private static List<NotaRequest> NoNotas => new();

        private async Task<(string UserId, string TeamId, string GameModelId, string PrincipleId, string SubprincipioId)> SeedGameModelAsync(AppDbContext db)
        {
            var club = Club.Create($"UpdateGameModel Test Club {Guid.NewGuid():N}", 1);
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
                Name = "UpdateGameModel Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var model = new GameModel(team.Id, "Modelo de prueba", "2025-2026");
            var principle = new GamePrinciple(model.Id, gameMomentId: 1, key: "defensa-organizada-1", numero: 1, "Principio original", "Texto original");
            var subprincipio = new Subprincipio(principle.Id, "defensa-organizada-1.1", "1.1", "Subprincipio original", "Contexto original");
            principle.Subprincipios.Add(subprincipio);
            model.Principles.Add(principle);
            db.GameModels.Add(model);
            await db.SaveChangesAsync();

            return (userId, team.Id, model.Id, principle.Id, subprincipio.Id);
        }

        private static PrincipleRequest OriginalPrincipleRequest(string principleId, string subprincipioId, string subprincipioNumero = "1.1", string titulo = "Subprincipio original") =>
            new(principleId, 1, 1, "Principio original", "Texto original",
                new List<SubprincipioRequest>
                {
                    new(subprincipioId, subprincipioNumero, titulo, "Contexto original", new List<ZonaRequest>(), new List<SubSubPrincipioRequest>(), NoNotas)
                },
                NoNotas);

        [Fact]
        public async Task Update_WithNewPrincipleContainingSubprincipio_CreatesPrincipleAndSubprincipio()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, gameModelId, principleId, subprincipioId) = await SeedGameModelAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateGameModelHandler(db);

            var command = new UpdateGameModelCommand(
                "Modelo de prueba",
                new List<PrincipleRequest>
                {
                    OriginalPrincipleRequest(principleId, subprincipioId),
                    new PrincipleRequest(null, 2, 1, "Principio nuevo", "Texto nuevo",
                        new List<SubprincipioRequest>
                        {
                            new(null, "1.1", "Subprincipio nuevo", "Contexto nuevo", new List<ZonaRequest>(), new List<SubSubPrincipioRequest>(), NoNotas)
                        },
                        NoNotas)
                },
                NoRules, NoIssues)
            { Id = gameModelId, UserId = userId };

            await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var principles = await verifyDb.GamePrinciples
                .Include(p => p.Subprincipios)
                .Where(p => p.GameModelId == gameModelId)
                .ToListAsync();

            Assert.Equal(2, principles.Count);
            var newPrinciple = Assert.Single(principles, p => p.Titulo == "Principio nuevo");
            Assert.Single(newPrinciple.Subprincipios);
            Assert.Equal("Subprincipio nuevo", newPrinciple.Subprincipios.Single().Titulo);
        }

        [Fact]
        public async Task Update_ExistingPrincipleTituloAndTexto_UpdatesInPlace_SubprincipiosUnaffected()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, gameModelId, principleId, subprincipioId) = await SeedGameModelAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateGameModelHandler(db);

            var command = new UpdateGameModelCommand(
                "Modelo de prueba",
                new List<PrincipleRequest>
                {
                    new PrincipleRequest(principleId, 1, 1, "Principio editado", "Texto editado",
                        new List<SubprincipioRequest>
                        {
                            new(subprincipioId, "1.1", "Subprincipio original", "Contexto original", new List<ZonaRequest>(), new List<SubSubPrincipioRequest>(), NoNotas)
                        },
                        NoNotas)
                },
                NoRules, NoIssues)
            { Id = gameModelId, UserId = userId };

            await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var principle = await verifyDb.GamePrinciples
                .Include(p => p.Subprincipios)
                .SingleAsync(p => p.Id == principleId);

            Assert.Equal("Principio editado", principle.Titulo);
            Assert.Equal("Texto editado", principle.Texto);
            var subprincipio = Assert.Single(principle.Subprincipios);
            Assert.Equal(subprincipioId, subprincipio.Id);
            Assert.Equal("Subprincipio original", subprincipio.Titulo);
        }

        [Fact]
        public async Task Update_WithoutPreviouslyExistingPrinciple_DeletesPrincipleAndItsSubprincipios()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, gameModelId, principleId, subprincipioId) = await SeedGameModelAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateGameModelHandler(db);

            var command = new UpdateGameModelCommand("Modelo de prueba", new List<PrincipleRequest>(), NoRules, NoIssues)
            { Id = gameModelId, UserId = userId };

            await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            Assert.False(await verifyDb.GamePrinciples.AnyAsync(p => p.Id == principleId));
            Assert.False(await verifyDb.Subprincipios.AnyAsync(s => s.Id == subprincipioId));
        }

        [Fact]
        public async Task Update_AddingSubprincipioToExistingPrinciple_PersistsNewSubprincipio()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, gameModelId, principleId, subprincipioId) = await SeedGameModelAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateGameModelHandler(db);

            var command = new UpdateGameModelCommand(
                "Modelo de prueba",
                new List<PrincipleRequest>
                {
                    new PrincipleRequest(principleId, 1, 1, "Principio original", "Texto original",
                        new List<SubprincipioRequest>
                        {
                            new(subprincipioId, "1.1", "Subprincipio original", "Contexto original", new List<ZonaRequest>(), new List<SubSubPrincipioRequest>(), NoNotas),
                            new(null, "1.2", "Subprincipio adicional", "Contexto adicional", new List<ZonaRequest>(), new List<SubSubPrincipioRequest>(), NoNotas)
                        },
                        NoNotas)
                },
                NoRules, NoIssues)
            { Id = gameModelId, UserId = userId };

            await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var subprincipios = await verifyDb.Subprincipios
                .Where(s => s.GamePrincipleId == principleId)
                .ToListAsync();

            Assert.Equal(2, subprincipios.Count);
            Assert.Contains(subprincipios, s => s.Titulo == "Subprincipio adicional");
        }

        [Fact]
        public async Task Update_RemovingSubprincipioFromExistingPrinciple_DeletesSubprincipio()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, gameModelId, principleId, subprincipioId) = await SeedGameModelAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateGameModelHandler(db);

            var command = new UpdateGameModelCommand(
                "Modelo de prueba",
                new List<PrincipleRequest>
                {
                    new PrincipleRequest(principleId, 1, 1, "Principio original", "Texto original", new List<SubprincipioRequest>(), NoNotas)
                },
                NoRules, NoIssues)
            { Id = gameModelId, UserId = userId };

            await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            Assert.False(await verifyDb.Subprincipios.AnyAsync(s => s.Id == subprincipioId));
            Assert.True(await verifyDb.GamePrinciples.AnyAsync(p => p.Id == principleId));
        }

        [Fact]
        public async Task Update_UnknownGameModelId_ThrowsGameModelNotFound()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, _, _, _) = await SeedGameModelAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateGameModelHandler(db);

            var command = new UpdateGameModelCommand("Modelo de prueba", new List<PrincipleRequest>(), NoRules, NoIssues)
            { Id = Guid.NewGuid().ToString(), UserId = userId };

            var ex = await Assert.ThrowsAsync<DomainException>(() => handler.Handle(command, CancellationToken.None).AsTask());
            Assert.Equal(ErrorCodes.GameModelNotFound, ex.Code);
        }

        [Fact]
        public async Task Update_UserWithoutAccess_ThrowsGameModelAccessDenied()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (_, _, gameModelId, _, _) = await SeedGameModelAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateGameModelHandler(db);

            var command = new UpdateGameModelCommand("Modelo de prueba", new List<PrincipleRequest>(), NoRules, NoIssues)
            { Id = gameModelId, UserId = $"stranger-{Guid.NewGuid():N}" };

            var ex = await Assert.ThrowsAsync<DomainException>(() => handler.Handle(command, CancellationToken.None).AsTask());
            Assert.Equal(ErrorCodes.GameModelAccessDenied, ex.Code);
        }

        [Fact]
        public async Task Update_SavingModel_ChangesStoredVersion()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, gameModelId, principleId, subprincipioId) = await SeedGameModelAsync(seedDb);

            await using var beforeDb = _fixture.CreateDbContext();
            var versionBefore = (await beforeDb.GameModels.AsNoTracking().SingleAsync(gm => gm.Id == gameModelId)).Version;

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateGameModelHandler(db);

            var command = new UpdateGameModelCommand(
                "Modelo de prueba",
                new List<PrincipleRequest> { OriginalPrincipleRequest(principleId, subprincipioId) },
                NoRules, NoIssues)
            { Id = gameModelId, UserId = userId };

            await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var versionAfter = (await verifyDb.GameModels.AsNoTracking().SingleAsync(gm => gm.Id == gameModelId)).Version;

            Assert.NotEqual(versionBefore, versionAfter);
        }

        private async Task<GetGameModel.GameModelResponse> ReadModelAsync(string teamId, string userId)
        {
            await using var db = _fixture.CreateDbContext();
            var handler = new GetGameModel.Handler(db);
            var result = await handler.Handle(
                new GetGameModel.GameModelQuery(teamId, "2025-2026", userId), CancellationToken.None);
            return result!;
        }

        private static UpdateGameModelCommand RenameCommand(string gameModelId, string userId, string name, string? expectedVersion) =>
            new UpdateGameModelCommand(name, new List<PrincipleRequest>(), NoRules, NoIssues, expectedVersion)
            { Id = gameModelId, UserId = userId };

        [Fact]
        public async Task Update_WithMatchingExpectedVersion_AppliesUpdateAndChangesMarker()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId, gameModelId, _, _) = await SeedGameModelAsync(seedDb);
            var current = await ReadModelAsync(teamId, userId);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateGameModelHandler(db);
            await handler.Handle(RenameCommand(gameModelId, userId, "Modelo editado", current.Version), CancellationToken.None);

            var after = await ReadModelAsync(teamId, userId);
            Assert.Equal("Modelo editado", after.Name);
            Assert.NotEqual(current.Version, after.Version);
        }

        [Fact]
        public async Task Update_WithOutdatedExpectedVersion_ThrowsConflictWithGameModelStaleCode()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId, gameModelId, _, _) = await SeedGameModelAsync(seedDb);
            var outdated = await ReadModelAsync(teamId, userId);

            await using var saveDb = _fixture.CreateDbContext();
            await new UpdateGameModelHandler(saveDb).Handle(
                RenameCommand(gameModelId, userId, "Modelo intermedio", expectedVersion: null), CancellationToken.None);

            await using var beforeDb = _fixture.CreateDbContext();
            var versionBefore = (await beforeDb.GameModels.AsNoTracking().SingleAsync(gm => gm.Id == gameModelId)).Version;

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateGameModelHandler(db);
            var command = RenameCommand(gameModelId, userId, "Modelo rechazado", outdated.Version);

            var ex = await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(command, CancellationToken.None).AsTask());
            Assert.Equal(ErrorCodes.GameModelStale, ex.Code);

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.GameModels.AsNoTracking().SingleAsync(gm => gm.Id == gameModelId);
            Assert.Equal("Modelo intermedio", stored.Name);
            Assert.Equal(versionBefore, stored.Version);
        }

        [Fact]
        public async Task Update_WithoutExpectedVersion_AppliesUpdateAndChangesMarker()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId, gameModelId, _, _) = await SeedGameModelAsync(seedDb);
            var before = await ReadModelAsync(teamId, userId);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateGameModelHandler(db);
            await handler.Handle(RenameCommand(gameModelId, userId, "Modelo sin marcador", expectedVersion: null), CancellationToken.None);

            var after = await ReadModelAsync(teamId, userId);
            Assert.Equal("Modelo sin marcador", after.Name);
            Assert.NotEqual(before.Version, after.Version);
        }
    }
}
