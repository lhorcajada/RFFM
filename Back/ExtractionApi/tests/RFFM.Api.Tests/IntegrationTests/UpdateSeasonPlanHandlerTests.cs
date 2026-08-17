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
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.SeasonPlans.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Integration tests for PUT /api/season-plans/{id} (<see cref="UpdateSeasonPlanCommand"/>).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class UpdateSeasonPlanHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UpdateSeasonPlanHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string UserId, string TeamId, string SeasonPlanId, string MacrocicloId, string MesocicloId, string MicrocicloId)> SeedPlanAsync(AppDbContext db)
        {
            var club = Club.Create($"UpdateSeasonPlan Test Club {Guid.NewGuid():N}", 1);
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
                Name = "UpdateSeasonPlan Test Team",
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
            var macrociclo = new Macrociclo(plan.Id, 1, "Macrociclo original", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21));
            var mesociclo = new Mesociclo(macrociclo.Id, 1, "Mesociclo original", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21), 2);
            var microciclo = new Microciclo(mesociclo.Id, 1, "Semana original", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "Obj A", "Obj B");
            mesociclo.Microciclos.Add(microciclo);
            macrociclo.Mesociclos.Add(mesociclo);
            plan.Macrociclos.Add(macrociclo);
            db.SeasonPlans.Add(plan);
            await db.SaveChangesAsync();

            return (userId, team.Id, plan.Id, macrociclo.Id, mesociclo.Id, microciclo.Id);
        }

        private async Task<(string SubprincipioId, string SubSubPrincipioId)> SeedAdnNodesAsync(AppDbContext db, string teamId)
        {
            var model = new GameModel(teamId, "Modelo de prueba", "2026-2027");
            var principle = new GamePrinciple(model.Id, gameMomentId: 1, key: $"principio-{Guid.NewGuid():N}", numero: 1, "Principio", "Texto");
            var subprincipio = new Subprincipio(principle.Id, $"sub-{Guid.NewGuid():N}", "1.1", "Subprincipio", "Contexto");
            var subSubPrincipio = new SubSubPrincipio($"subsub-{Guid.NewGuid():N}", "1.1.1", "Rol", "Texto", subprincipio.Id, null);

            principle.Subprincipios.Add(subprincipio);
            subprincipio.SubSubPrincipios.Add(subSubPrincipio);
            model.Principles.Add(principle);

            db.GameModels.Add(model);
            await db.SaveChangesAsync();

            return (subprincipio.Id, subSubPrincipio.Id);
        }

        [Fact]
        public async Task Update_ExistingNodesById_UpdatesInPlace()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, planId, macrocicloId, mesocicloId, microcicloId) = await SeedPlanAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateSeasonPlanHandler(db);

            var command = new UpdateSeasonPlanCommand(
                new List<MacrocicloUpdateRequest>
                {
                    new(macrocicloId, "Macrociclo editado", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21),
                        new List<MesocicloUpdateRequest>
                        {
                            new(mesocicloId, "Mesociclo editado", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21), 3,
                                new List<MicrocicloUpdateRequest>
                                {
                                    new(microcicloId, "Semana editada", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "Obj A editado", "Obj B editado"),
                                })
                        })
                })
            { Id = planId, UserId = userId };

            await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var macrociclo = await verifyDb.Macrociclos
                .Include(m => m.Mesociclos).ThenInclude(m => m.Microciclos)
                .SingleAsync(m => m.Id == macrocicloId);

            Assert.Equal("Macrociclo editado", macrociclo.Name);
            var mesociclo = Assert.Single(macrociclo.Mesociclos);
            Assert.Equal("Mesociclo editado", mesociclo.Name);
            Assert.Equal(3, mesociclo.GameZoneId);
            var microciclo = Assert.Single(mesociclo.Microciclos);
            Assert.Equal("Semana editada", microciclo.WeekLabel);
            Assert.Equal("Obj A editado", microciclo.ObjetivoSesionA);
        }

        [Fact]
        public async Task Update_AddingNewMicrocicloWithoutId_CreatesIt()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, planId, macrocicloId, mesocicloId, microcicloId) = await SeedPlanAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateSeasonPlanHandler(db);

            var command = new UpdateSeasonPlanCommand(
                new List<MacrocicloUpdateRequest>
                {
                    new(macrocicloId, "Macrociclo original", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21),
                        new List<MesocicloUpdateRequest>
                        {
                            new(mesocicloId, "Mesociclo original", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21), 2,
                                new List<MicrocicloUpdateRequest>
                                {
                                    new(microcicloId, "Semana original", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "Obj A", "Obj B"),
                                    new(null, "Semana nueva", new DateOnly(2026, 9, 8), new DateOnly(2026, 9, 14), "Obj A nueva", "Obj B nueva"),
                                })
                        })
                })
            { Id = planId, UserId = userId };

            await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var microciclos = await verifyDb.Microciclos.Where(m => m.MesocicloId == mesocicloId).ToListAsync();

            Assert.Equal(2, microciclos.Count);
            Assert.Contains(microciclos, m => m.WeekLabel == "Semana nueva");
        }

        [Fact]
        public async Task Update_RemovingMicrocicloFromRequest_DeletesIt()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, planId, macrocicloId, mesocicloId, microcicloId) = await SeedPlanAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateSeasonPlanHandler(db);

            var command = new UpdateSeasonPlanCommand(
                new List<MacrocicloUpdateRequest>
                {
                    new(macrocicloId, "Macrociclo original", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21),
                        new List<MesocicloUpdateRequest>
                        {
                            new(mesocicloId, "Mesociclo original", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21), 2,
                                new List<MicrocicloUpdateRequest>())
                        })
                })
            { Id = planId, UserId = userId };

            await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            Assert.False(await verifyDb.Microciclos.AnyAsync(m => m.Id == microcicloId));
        }

        [Fact]
        public async Task Update_UnknownSeasonPlanId_ThrowsSeasonPlanNotFound()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, _, _, _, _) = await SeedPlanAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateSeasonPlanHandler(db);

            var command = new UpdateSeasonPlanCommand(new List<MacrocicloUpdateRequest>())
            { Id = Guid.NewGuid().ToString(), UserId = userId };

            var ex = await Assert.ThrowsAsync<DomainException>(() => handler.Handle(command, CancellationToken.None).AsTask());
            Assert.Equal(ErrorCodes.SeasonPlanNotFound, ex.Code);
        }

        [Fact]
        public async Task Update_UserWithoutAccess_ThrowsSeasonPlanAccessDenied()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (_, _, planId, _, _, _) = await SeedPlanAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateSeasonPlanHandler(db);

            var command = new UpdateSeasonPlanCommand(new List<MacrocicloUpdateRequest>())
            { Id = planId, UserId = $"stranger-{Guid.NewGuid():N}" };

            var ex = await Assert.ThrowsAsync<DomainException>(() => handler.Handle(command, CancellationToken.None).AsTask());
            Assert.Equal(ErrorCodes.SeasonPlanAccessDenied, ex.Code);
        }

        [Fact]
        public async Task Update_AddingSesionAdnLinks_PersistsThem()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId, planId, macrocicloId, mesocicloId, microcicloId) = await SeedPlanAsync(seedDb);
            var (subprincipioId, subSubPrincipioId) = await SeedAdnNodesAsync(seedDb, teamId);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateSeasonPlanHandler(db);

            var command = new UpdateSeasonPlanCommand(
                new List<MacrocicloUpdateRequest>
                {
                    new(macrocicloId, "Macrociclo original", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21),
                        new List<MesocicloUpdateRequest>
                        {
                            new(mesocicloId, "Mesociclo original", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21), 2,
                                new List<MicrocicloUpdateRequest>
                                {
                                    new(microcicloId, "Semana original", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "Obj A", "Obj B",
                                        SesionASubprincipioIds: new List<string> { subprincipioId },
                                        SesionASubSubPrincipioIds: new List<string> { subSubPrincipioId },
                                        SesionAHabilidades: new List<string> { "Pase" }),
                                })
                        })
                })
            { Id = planId, UserId = userId };

            await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var microciclo = await verifyDb.Microciclos
                .Include(m => m.SubprincipioLinks)
                .Include(m => m.SubSubPrincipioLinks)
                .SingleAsync(m => m.Id == microcicloId);

            Assert.Equal(new List<string> { "Pase" }, microciclo.SesionAHabilidades);
            var subprincipioLink = Assert.Single(microciclo.SubprincipioLinks);
            Assert.Equal(subprincipioId, subprincipioLink.SubprincipioId);
            var subSubPrincipioLink = Assert.Single(microciclo.SubSubPrincipioLinks);
            Assert.Equal(subSubPrincipioId, subSubPrincipioLink.SubSubPrincipioId);
        }

        [Fact]
        public async Task Update_CalledAgainWithDifferentLinks_ReplacesPreviousLinks()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId, planId, macrocicloId, mesocicloId, microcicloId) = await SeedPlanAsync(seedDb);
            var (firstSubprincipioId, _) = await SeedAdnNodesAsync(seedDb, teamId);
            var (secondSubprincipioId, _) = await SeedAdnNodesAsync(seedDb, teamId);

            await using var firstDb = _fixture.CreateDbContext();
            var firstHandler = new UpdateSeasonPlanHandler(firstDb);
            var firstCommand = new UpdateSeasonPlanCommand(
                new List<MacrocicloUpdateRequest>
                {
                    new(macrocicloId, "Macrociclo original", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21),
                        new List<MesocicloUpdateRequest>
                        {
                            new(mesocicloId, "Mesociclo original", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21), 2,
                                new List<MicrocicloUpdateRequest>
                                {
                                    new(microcicloId, "Semana original", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "Obj A", "Obj B",
                                        SesionASubprincipioIds: new List<string> { firstSubprincipioId }),
                                })
                        })
                })
            { Id = planId, UserId = userId };
            await firstHandler.Handle(firstCommand, CancellationToken.None);

            await using var secondDb = _fixture.CreateDbContext();
            var secondHandler = new UpdateSeasonPlanHandler(secondDb);
            var secondCommand = new UpdateSeasonPlanCommand(
                new List<MacrocicloUpdateRequest>
                {
                    new(macrocicloId, "Macrociclo original", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21),
                        new List<MesocicloUpdateRequest>
                        {
                            new(mesocicloId, "Mesociclo original", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21), 2,
                                new List<MicrocicloUpdateRequest>
                                {
                                    new(microcicloId, "Semana original", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "Obj A", "Obj B",
                                        SesionASubprincipioIds: new List<string> { secondSubprincipioId }),
                                })
                        })
                })
            { Id = planId, UserId = userId };
            await secondHandler.Handle(secondCommand, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var microciclo = await verifyDb.Microciclos
                .Include(m => m.SubprincipioLinks)
                .SingleAsync(m => m.Id == microcicloId);

            var link = Assert.Single(microciclo.SubprincipioLinks);
            Assert.Equal(secondSubprincipioId, link.SubprincipioId);
        }

        [Fact]
        public async Task Update_WithEmptyLinkLists_RemovesAllPreviouslySavedLinks()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId, planId, macrocicloId, mesocicloId, microcicloId) = await SeedPlanAsync(seedDb);
            var (subprincipioId, _) = await SeedAdnNodesAsync(seedDb, teamId);

            await using var firstDb = _fixture.CreateDbContext();
            var firstHandler = new UpdateSeasonPlanHandler(firstDb);
            var firstCommand = new UpdateSeasonPlanCommand(
                new List<MacrocicloUpdateRequest>
                {
                    new(macrocicloId, "Macrociclo original", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21),
                        new List<MesocicloUpdateRequest>
                        {
                            new(mesocicloId, "Mesociclo original", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21), 2,
                                new List<MicrocicloUpdateRequest>
                                {
                                    new(microcicloId, "Semana original", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "Obj A", "Obj B",
                                        SesionASubprincipioIds: new List<string> { subprincipioId },
                                        SesionAHabilidades: new List<string> { "Pase" }),
                                })
                        })
                })
            { Id = planId, UserId = userId };
            await firstHandler.Handle(firstCommand, CancellationToken.None);

            await using var secondDb = _fixture.CreateDbContext();
            var secondHandler = new UpdateSeasonPlanHandler(secondDb);
            var secondCommand = new UpdateSeasonPlanCommand(
                new List<MacrocicloUpdateRequest>
                {
                    new(macrocicloId, "Macrociclo original", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21),
                        new List<MesocicloUpdateRequest>
                        {
                            new(mesocicloId, "Mesociclo original", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21), 2,
                                new List<MicrocicloUpdateRequest>
                                {
                                    new(microcicloId, "Semana original", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7), "Obj A", "Obj B",
                                        SesionASubprincipioIds: new List<string>(),
                                        SesionAHabilidades: new List<string>()),
                                })
                        })
                })
            { Id = planId, UserId = userId };
            await secondHandler.Handle(secondCommand, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var microciclo = await verifyDb.Microciclos
                .Include(m => m.SubprincipioLinks)
                .SingleAsync(m => m.Id == microcicloId);

            Assert.Empty(microciclo.SubprincipioLinks);
            Assert.Empty(microciclo.SesionAHabilidades);
        }
    }
}
