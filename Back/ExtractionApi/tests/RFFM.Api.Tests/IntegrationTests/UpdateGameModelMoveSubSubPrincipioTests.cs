#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.GameModels.Commands;
using RFFM.Api.Features.Coaches.Trainings.Sessions;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// PUT /api/game-models/{id}: moving a SubSubPrincipio between the parents of its own
    /// Subprincipio (general ↔ zona, zona → zona, into a new zona) keeps its identity, so its
    /// Habilidades and the session targets pointing at it survive.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class UpdateGameModelMoveSubSubPrincipioTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UpdateGameModelMoveSubSubPrincipioTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static List<NotaRequest> NoNotas => new();

        private sealed record Seeded(
            string UserId, string TeamId, string GameModelId, string PrincipleId, string SubprincipioId,
            string ZonaId, string GeneralSspId, string GeneralHabilidadId, string ZonaSspId);

        /// <summary>One Subprincipio with a general SubSubPrincipio (with a Habilidad) and a Zona
        /// holding another SubSubPrincipio.</summary>
        private static async Task<Seeded> SeedAsync(AppDbContext db)
        {
            var club = Club.Create($"MoveSsp Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "MoveSsp Test Team", CategoryId = Category.NationalCategory.Id, ClubId = club.Id, SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var model = new GameModel(team.Id, "Modelo de prueba", "2026-2027");
            var principle = new GamePrinciple(model.Id, gameMomentId: 1, key: $"principio-{Guid.NewGuid():N}", numero: 1, "Principio", "Texto");
            var subprincipio = new Subprincipio(principle.Id, $"sub-{Guid.NewGuid():N}", "1.1", "Subprincipio", "Contexto");

            var general = new SubSubPrincipio($"ssp-general-{Guid.NewGuid():N}", "1.1.1", "Rol general", "Texto general", subprincipio.Id, null);
            var habilidad = new Habilidad(general.Id, "Pase", "Descripción", "Entrenable", null);
            general.Habilidades.Add(habilidad);
            subprincipio.SubSubPrincipios.Add(general);

            var zona = new Zona(subprincipio.Id, $"zona-{Guid.NewGuid():N}", "iniciacion", null, null, "Zona");
            var zonaSsp = new SubSubPrincipio($"ssp-zona-{Guid.NewGuid():N}", "1.1.2", "Rol zona", "Texto zona", null, zona.Id);
            zona.SubSubPrincipios.Add(zonaSsp);
            subprincipio.Zonas.Add(zona);

            principle.Subprincipios.Add(subprincipio);
            model.Principles.Add(principle);
            db.GameModels.Add(model);
            await db.SaveChangesAsync();

            return new Seeded(userId, team.Id, model.Id, principle.Id, subprincipio.Id, zona.Id, general.Id, habilidad.Id, zonaSsp.Id);
        }

        private static SubSubPrincipioRequest GeneralRequest(Seeded s) =>
            new(s.GeneralSspId, "1.1.1", "Rol general", "Texto general",
                new List<HabilidadRequest> { new(s.GeneralHabilidadId, "Pase", "Descripción", "Entrenable", null) },
                NoNotas);

        private static SubSubPrincipioRequest ZonaSspRequest(Seeded s) =>
            new(s.ZonaSspId, "1.1.2", "Rol zona", "Texto zona", new List<HabilidadRequest>(), NoNotas);

        private static ZonaRequest ExistingZona(Seeded s, params SubSubPrincipioRequest[] ssps) =>
            new(s.ZonaId, "iniciacion", null, null, "Zona", ssps.ToList(), NoNotas);

        private static UpdateGameModelCommand Command(Seeded s, List<ZonaRequest> zonas, List<SubSubPrincipioRequest> generals) =>
            new("Modelo de prueba",
                new List<PrincipleRequest>
                {
                    new(s.PrincipleId, 1, 1, "Principio", "Texto",
                        new List<SubprincipioRequest> { new(s.SubprincipioId, "1.1", "Subprincipio", "Contexto", zonas, generals, NoNotas) },
                        NoNotas)
                },
                new List<SetPieceRuleRequest>(), new List<OpenIssueRequest>())
            { Id = s.GameModelId, UserId = s.UserId };

        private async Task UpdateAsync(UpdateGameModelCommand command)
        {
            await using var db = _fixture.CreateDbContext();
            await new UpdateGameModelHandler(db).Handle(command, CancellationToken.None);
        }

        private async Task<SubSubPrincipio?> FindSspAsync(string id)
        {
            await using var db = _fixture.CreateDbContext();
            return await db.SubSubPrincipios.Include(x => x.Habilidades).AsNoTracking().SingleOrDefaultAsync(x => x.Id == id);
        }

        [Fact]
        public async Task Update_MovingGeneralToExistingZona_KeepsIdHabilidadAndSessionTarget()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var s = await SeedAsync(seedDb);
            await using (var sessionDb = _fixture.CreateDbContext())
            {
                var createSession = new CreateSessionCommand(
                    s.TeamId, "Sesión", null, null, null, null, null, null, null, null, null,
                    new List<SessionBlockRequest>(), new List<string> { s.GeneralSspId })
                { UserId = s.UserId };
                await new CreateSessionHandler(sessionDb).Handle(createSession, CancellationToken.None);
            }

            await UpdateAsync(Command(s, new List<ZonaRequest> { ExistingZona(s, ZonaSspRequest(s), GeneralRequest(s)) }, new List<SubSubPrincipioRequest>()));

            var moved = await FindSspAsync(s.GeneralSspId);
            Assert.NotNull(moved);
            Assert.Equal(s.ZonaId, moved!.ZonaId);
            Assert.Null(moved.SubprincipioId);
            Assert.Equal(s.GeneralHabilidadId, Assert.Single(moved.Habilidades).Id);
            await using var verifyDb = _fixture.CreateDbContext();
            Assert.True(await verifyDb.Set<RFFM.Api.Domain.Aggregates.Training.TrainingSessionSubSubPrincipio>()
                .AnyAsync(t => t.SubSubPrincipioId == s.GeneralSspId));
        }

        [Fact]
        public async Task Update_MovingGeneralToNewZona_CreatesZonaAndKeepsId()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var s = await SeedAsync(seedDb);
            var newZona = new ZonaRequest(null, "finalizacion", "Zona nueva", null, "Texto", new List<SubSubPrincipioRequest> { GeneralRequest(s) }, NoNotas);

            await UpdateAsync(Command(s, new List<ZonaRequest> { ExistingZona(s, ZonaSspRequest(s)), newZona }, new List<SubSubPrincipioRequest>()));

            await using var verifyDb = _fixture.CreateDbContext();
            var createdZona = await verifyDb.Zonas.SingleAsync(z => z.SubprincipioId == s.SubprincipioId && z.Label == "Zona nueva");
            var moved = await FindSspAsync(s.GeneralSspId);
            Assert.NotNull(moved);
            Assert.Equal(createdZona.Id, moved!.ZonaId);
        }

        [Fact]
        public async Task Update_MovingZonaSspToGeneral_KeepsIdAndHangsFromSubprincipio()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var s = await SeedAsync(seedDb);

            await UpdateAsync(Command(s, new List<ZonaRequest> { ExistingZona(s) }, new List<SubSubPrincipioRequest> { GeneralRequest(s), ZonaSspRequest(s) }));

            var moved = await FindSspAsync(s.ZonaSspId);
            Assert.NotNull(moved);
            Assert.Equal(s.SubprincipioId, moved!.SubprincipioId);
            Assert.Null(moved.ZonaId);
        }

        [Fact]
        public async Task Update_MovingSspOutOfDeletedZona_KeepsSsp()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var s = await SeedAsync(seedDb);

            await UpdateAsync(Command(s, new List<ZonaRequest>(), new List<SubSubPrincipioRequest> { GeneralRequest(s), ZonaSspRequest(s) }));

            await using var verifyDb = _fixture.CreateDbContext();
            Assert.False(await verifyDb.Zonas.AnyAsync(z => z.Id == s.ZonaId));
            var moved = await FindSspAsync(s.ZonaSspId);
            Assert.NotNull(moved);
            Assert.Equal(s.SubprincipioId, moved!.SubprincipioId);
        }

        [Fact]
        public async Task Update_SspMissingFromRequest_IsDeleted()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var s = await SeedAsync(seedDb);

            await UpdateAsync(Command(s, new List<ZonaRequest> { ExistingZona(s, ZonaSspRequest(s)) }, new List<SubSubPrincipioRequest>()));

            Assert.Null(await FindSspAsync(s.GeneralSspId));
            Assert.NotNull(await FindSspAsync(s.ZonaSspId));
        }

        [Fact]
        public async Task Update_SubprincipioWithGeneralAndZona_PersistsBoth()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var s = await SeedAsync(seedDb);

            await UpdateAsync(Command(s, new List<ZonaRequest> { ExistingZona(s, ZonaSspRequest(s)) }, new List<SubSubPrincipioRequest> { GeneralRequest(s) }));

            var general = await FindSspAsync(s.GeneralSspId);
            var zonaSsp = await FindSspAsync(s.ZonaSspId);
            Assert.Equal(s.SubprincipioId, general!.SubprincipioId);
            Assert.Equal(s.ZonaId, zonaSsp!.ZonaId);
        }
    }
}
