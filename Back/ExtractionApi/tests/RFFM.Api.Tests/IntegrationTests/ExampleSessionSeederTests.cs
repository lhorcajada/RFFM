#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Persistence.Seed;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Covers <see cref="ExampleSessionSeeder"/> (design.md §3 of the
    /// `session-exercise-plan-redesign` change): rebuilds "Sesión 1" from Ejemplo-Sesion.md
    /// with a minimal hand-built GameModel standing in for the real ADN import (which has its
    /// own dedicated, pre-existing test coverage).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class ExampleSessionSeederTests
    {
        private readonly PostgresContainerFixture _fixture;

        public ExampleSessionSeederTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string ClubId, string TeamId, string SeasonId)> SeedTeamWithGameModelAsync(AppDbContext db)
        {
            var club = Club.Create($"ExampleSession Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "ExampleSession Test Team", CategoryId = Category.NationalCategory.Id, ClubId = club.Id, SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var model = new GameModel(team.Id, "Modelo de prueba", "2026-2027");

            var defensaOrganizada = new GamePrinciple(model.Id, gameMomentId: 1, key: "p-defensa", numero: 1, "No permitir progresar al rival", "Texto");
            var subDefensa = new Subprincipio(defensaOrganizada.Id, "sub-defensa", "1.1", "Evitar que el rival supere nuestra primera línea de presión", "Contexto");
            foreach (var (numero, rol) in new[] { ("1.1.20", "Delantero"), ("1.1.21", "Media punta"), ("1.1.22", "Extremo"), ("1.1.23", "Mediocentros"), ("1.1.24", "Laterales y centrales") })
                subDefensa.SubSubPrincipios.Add(new SubSubPrincipio($"subsub-{numero}", numero, rol, "Texto", subDefensa.Id, null));
            defensaOrganizada.Subprincipios.Add(subDefensa);
            model.Principles.Add(defensaOrganizada);

            var transicion = new GamePrinciple(model.Id, gameMomentId: 3, key: "p-transicion", numero: 1, "Decidir entre velocidad y paciencia según la zona de recuperación", "Texto");
            var subTransicion = new Subprincipio(transicion.Id, "sub-transicion", "1.1", "Elegir el modo de salida según la zona de recuperación", "Contexto");
            foreach (var (numero, rol) in new[] { ("1.1.3", "Jugador que recupera"), ("1.1.4", "Resto del equipo") })
                subTransicion.SubSubPrincipios.Add(new SubSubPrincipio($"subsub-{numero}", numero, rol, "Texto", subTransicion.Id, null));
            transicion.Subprincipios.Add(subTransicion);
            model.Principles.Add(transicion);

            db.GameModels.Add(model);
            await db.SaveChangesAsync();

            return (club.Id, team.Id, season.Id);
        }

        [Fact]
        public async Task SeedAsync_CreatesFullStructure()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (clubId, teamId, seasonId) = await SeedTeamWithGameModelAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            await ExampleSessionSeeder.SeedAsync(db, clubId, teamId, seasonId, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var session = await verifyDb.TrainingSessions
                .Include(s => s.Blocks).ThenInclude(b => b.Exercises)
                .SingleAsync(s => s.TeamId == teamId);

            Assert.NotNull(session.MicrocicloId);
            Assert.Equal(4, session.Blocks.Count);

            var bloque2 = session.Blocks.Single(b => b.Order == 2);
            Assert.Equal(2, bloque2.Exercises.Count);

            var exercises = await verifyDb.TaskTrainingBases
                .Include(e => e.ModelRelations).ThenInclude(r => r.Items)
                .Where(e => e.ClubId == clubId)
                .ToListAsync();
            Assert.Equal(5, exercises.Count);

            var defensaBloqueMedio = exercises.Single(e => e.Name == "Defensa organizada, bloque medio");
            var relation = Assert.Single(defensaBloqueMedio.ModelRelations);
            Assert.True(relation.IsFoco);
            Assert.Equal(5, relation.Items.Count);
        }

        [Fact]
        public async Task SeedAsync_RunTwice_UpsertsWithoutDuplicating()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (clubId, teamId, seasonId) = await SeedTeamWithGameModelAsync(seedDb);

            await using var firstDb = _fixture.CreateDbContext();
            await ExampleSessionSeeder.SeedAsync(firstDb, clubId, teamId, seasonId, CancellationToken.None);

            await using var secondDb = _fixture.CreateDbContext();
            await ExampleSessionSeeder.SeedAsync(secondDb, clubId, teamId, seasonId, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            Assert.Equal(1, await verifyDb.TrainingSessions.CountAsync(s => s.TeamId == teamId));
            Assert.Equal(5, await verifyDb.TaskTrainingBases.CountAsync(e => e.ClubId == clubId));
            Assert.Equal(1, await verifyDb.SeasonPlans.CountAsync(sp => sp.TeamId == teamId));
        }
    }
}
