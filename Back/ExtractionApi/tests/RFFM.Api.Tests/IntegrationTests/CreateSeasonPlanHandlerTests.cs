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
using RFFM.Api.Features.Coaches.SeasonPlans.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Integration tests for POST /api/season-plans (<see cref="CreateSeasonPlanCommand"/>).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class CreateSeasonPlanHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public CreateSeasonPlanHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string UserId, string TeamId, string SeasonId)> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"CreateSeasonPlan Test Club {Guid.NewGuid():N}", 1);
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
                Name = "CreateSeasonPlan Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            return (userId, team.Id, season.Id);
        }

        private static async Task<string> SeedSubprincipioAsync(AppDbContext db, string teamId)
        {
            var model = new GameModel(teamId, "Modelo de prueba", "2026-2027");
            var principle = new GamePrinciple(model.Id, gameMomentId: 1, key: $"principio-{Guid.NewGuid():N}", numero: 1, "Principio", "Texto");
            var subprincipio = new Subprincipio(principle.Id, $"sub-{Guid.NewGuid():N}", "1.1", "Subprincipio", "Contexto");
            principle.Subprincipios.Add(subprincipio);
            model.Principles.Add(principle);
            db.GameModels.Add(model);
            await db.SaveChangesAsync();
            return subprincipio.Id;
        }

        private static List<MacrocicloRequest> OneMacrocicloWithTree() => new()
        {
            new MacrocicloRequest(1, "Macrociclo 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21),
                new List<MesocicloRequest>
                {
                    new MesocicloRequest(1, "Mesociclo 1.1 — Creación Propia", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21), 2,
                        new List<MicrocicloRequest>
                        {
                            new MicrocicloRequest(1, "Semana 1 — Analítico", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7)),
                            new MicrocicloRequest(2, "Semana 2 — Situacional", new DateOnly(2026, 9, 8), new DateOnly(2026, 9, 14)),
                        })
                })
        };

        [Fact]
        public async Task Create_WithFullTree_PersistsMacrocicloMesocicloAndMicrociclo()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId, seasonId) = await SeedTeamAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateSeasonPlanHandler(db);

            var command = new CreateSeasonPlanCommand(teamId, seasonId, OneMacrocicloWithTree()) { UserId = userId };

            var planId = await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var macrociclo = await verifyDb.Macrociclos
                .Include(m => m.Mesociclos)
                    .ThenInclude(m => m.Microciclos)
                .SingleAsync(m => m.SeasonPlanId == planId);

            Assert.Equal("Macrociclo 1", macrociclo.Name);
            var mesociclo = Assert.Single(macrociclo.Mesociclos);
            Assert.Equal("Mesociclo 1.1 — Creación Propia", mesociclo.Name);
            Assert.Equal(2, mesociclo.GameZoneId);
            Assert.Equal(2, mesociclo.Microciclos.Count);
            Assert.Contains(mesociclo.Microciclos, m => m.WeekLabel == "Semana 1 — Analítico");
        }

        [Fact]
        public async Task Create_DuplicateTeamAndSeason_ThrowsSeasonPlanAlreadyExists()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId, seasonId) = await SeedTeamAsync(seedDb);

            await using var firstDb = _fixture.CreateDbContext();
            var firstHandler = new CreateSeasonPlanHandler(firstDb);
            var command = new CreateSeasonPlanCommand(teamId, seasonId, OneMacrocicloWithTree()) { UserId = userId };
            await firstHandler.Handle(command, CancellationToken.None);

            await using var secondDb = _fixture.CreateDbContext();
            var secondHandler = new CreateSeasonPlanHandler(secondDb);

            var ex = await Assert.ThrowsAsync<DomainException>(
                () => secondHandler.Handle(command, CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.SeasonPlanAlreadyExists, ex.Code);
        }

        [Fact]
        public async Task Create_UserWithoutTeamAccess_ThrowsTeamAccessDenied()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (_, teamId, seasonId) = await SeedTeamAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateSeasonPlanHandler(db);

            var command = new CreateSeasonPlanCommand(teamId, seasonId, OneMacrocicloWithTree())
            { UserId = $"stranger-{Guid.NewGuid():N}" };

            var ex = await Assert.ThrowsAsync<DomainException>(
                () => handler.Handle(command, CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.TeamAccessDenied, ex.Code);
        }

        [Fact]
        public async Task Create_WithSubprincipioObjetivoIds_PersistsThem()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId, seasonId) = await SeedTeamAsync(seedDb);
            var subprincipioId = await SeedSubprincipioAsync(seedDb, teamId);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateSeasonPlanHandler(db);

            var macrociclos = new List<MacrocicloRequest>
            {
                new(1, "Macrociclo 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21),
                    new List<MesocicloRequest>
                    {
                        new(1, "Mesociclo 1.1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21), 2,
                            new List<MicrocicloRequest>
                            {
                                new(1, "Semana 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7),
                                    SubprincipioObjetivoIds: new List<string> { subprincipioId }),
                            })
                    })
            };

            var command = new CreateSeasonPlanCommand(teamId, seasonId, macrociclos) { UserId = userId };
            var planId = await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var macrociclo = await verifyDb.Macrociclos
                .Include(m => m.Mesociclos).ThenInclude(m => m.Microciclos).ThenInclude(m => m.SubprincipiosObjetivo)
                .SingleAsync(m => m.SeasonPlanId == planId);
            var microciclo = macrociclo.Mesociclos.Single().Microciclos.Single();

            var target = Assert.Single(microciclo.SubprincipiosObjetivo);
            Assert.Equal(subprincipioId, target.SubprincipioId);
        }
    }
}
