#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.GameModels.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Integration tests for POST /api/game-models (<see cref="CreateGameModelCommand"/>),
    /// covering the ADN hierarchy: Principio → Subprincipio → (Zona | direct) → SubSubPrincipio → Habilidad.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class CreateGameModelHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public CreateGameModelHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string UserId, string TeamId)> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"CreateGameModel Test Club {Guid.NewGuid():N}", 1);
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
                Name = "CreateGameModel Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            return (userId, team.Id);
        }

        [Fact]
        public async Task Create_WithPrincipleContainingSubprincipios_PersistsPrincipleAndSubprincipios()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId) = await SeedTeamAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateGameModelHandler(db);

            var command = new CreateGameModelCommand(
                teamId, "Modelo de prueba", "2025-2026",
                new List<PrincipleRequest>
                {
                    new PrincipleRequest(
                        null, GameMomentId: 1, Numero: 1, "Principio 1", "Texto 1",
                        new List<SubprincipioRequest>
                        {
                            new SubprincipioRequest(null, "1.1", "Subprincipio 1", "Contexto 1", new List<ZonaRequest>(), new List<SubSubPrincipioRequest>(), new List<NotaRequest>()),
                            new SubprincipioRequest(null, "1.2", "Subprincipio 2", "Contexto 2", new List<ZonaRequest>(), new List<SubSubPrincipioRequest>(), new List<NotaRequest>())
                        },
                        new List<NotaRequest>())
                },
                new List<SetPieceRuleRequest>(),
                new List<OpenIssueRequest>())
            { UserId = userId };

            var gameModelId = await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var principle = await verifyDb.GamePrinciples
                .Include(p => p.Subprincipios)
                .SingleAsync(p => p.GameModelId == gameModelId);

            Assert.Equal("Principio 1", principle.Titulo);
            Assert.Equal("Texto 1", principle.Texto);
            Assert.Equal(1, principle.GameMomentId);
            Assert.Equal("defensa-organizada-1", principle.Key);
            Assert.Equal(2, principle.Subprincipios.Count);
            Assert.Contains(principle.Subprincipios, s => s.Titulo == "Subprincipio 1");
            Assert.Contains(principle.Subprincipios, s => s.Titulo == "Subprincipio 2");
        }

        [Fact]
        public async Task Create_WithMultiplePrinciples_PersistsEachIndependently()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId) = await SeedTeamAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateGameModelHandler(db);

            var command = new CreateGameModelCommand(
                teamId, "Modelo de prueba", "2025-2026",
                new List<PrincipleRequest>
                {
                    new PrincipleRequest(null, 1, 1, "Principio A", "", new List<SubprincipioRequest>(), new List<NotaRequest>()),
                    new PrincipleRequest(null, 2, 1, "Principio B", "", new List<SubprincipioRequest>(), new List<NotaRequest>())
                },
                new List<SetPieceRuleRequest>(),
                new List<OpenIssueRequest>())
            { UserId = userId };

            var gameModelId = await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var principles = await verifyDb.GamePrinciples
                .Where(p => p.GameModelId == gameModelId)
                .ToListAsync();

            Assert.Equal(2, principles.Count);
            Assert.Contains(principles, p => p.Titulo == "Principio A" && p.GameMomentId == 1);
            Assert.Contains(principles, p => p.Titulo == "Principio B" && p.GameMomentId == 2);
        }

        [Fact]
        public async Task Create_WithZonaAndSubSubPrincipioAndHabilidad_PersistsFullTree()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId) = await SeedTeamAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateGameModelHandler(db);

            var habilidad = new HabilidadRequest(null, "Activación", "Descripcion", "Entrenable", null);
            var ssp = new SubSubPrincipioRequest(null, "1.1.1", "Delantero", "Texto SSP", new List<HabilidadRequest> { habilidad }, new List<NotaRequest>());
            var zona = new ZonaRequest(null, "finalizacion", null, null, "Texto zona", new List<SubSubPrincipioRequest> { ssp }, new List<NotaRequest>());
            var subprincipio = new SubprincipioRequest(null, "1.1", "Subprincipio 1", "Texto SP", new List<ZonaRequest> { zona }, new List<SubSubPrincipioRequest>(), new List<NotaRequest>());
            var principio = new PrincipleRequest(null, 1, 1, "Principio 1", "Texto", new List<SubprincipioRequest> { subprincipio }, new List<NotaRequest>());

            var command = new CreateGameModelCommand(
                teamId, "Modelo de prueba", "2025-2026",
                new List<PrincipleRequest> { principio },
                new List<SetPieceRuleRequest>(),
                new List<OpenIssueRequest>())
            { UserId = userId };

            var gameModelId = await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var persistedZona = await verifyDb.Zonas
                .Include(z => z.SubSubPrincipios)
                    .ThenInclude(s => s.Habilidades)
                .SingleAsync(z => z.Subprincipio.GamePrinciple.GameModelId == gameModelId);

            Assert.Equal("defensa-organizada-1.1-finalizacion", persistedZona.Key);
            var persistedSsp = Assert.Single(persistedZona.SubSubPrincipios);
            Assert.Equal("defensa-organizada-1.1.1", persistedSsp.Key);
            Assert.Null(persistedSsp.SubprincipioId);
            Assert.Equal(persistedZona.Id, persistedSsp.ZonaId);
            var persistedHabilidad = Assert.Single(persistedSsp.Habilidades);
            Assert.Equal("Activación", persistedHabilidad.Nombre);
        }
    }
}
