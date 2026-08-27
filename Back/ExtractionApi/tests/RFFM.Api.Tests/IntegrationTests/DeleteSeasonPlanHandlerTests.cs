#nullable enable
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.SeasonPlans;
using RFFM.Api.Domain.Aggregates.Training;
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
    /// Integration tests for DELETE /api/season-plans/{id} (<see cref="DeleteSeasonPlanCommand"/>).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class DeleteSeasonPlanHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public DeleteSeasonPlanHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string UserId, string ClubId, string TeamId, string SeasonPlanId, string MicrocicloId)> SeedPlanAsync(AppDbContext db)
        {
            var club = Club.Create($"DeleteSeasonPlan Test Club {Guid.NewGuid():N}", 1);
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
                Name = "DeleteSeasonPlan Test Team",
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

            return (userId, club.Id, team.Id, plan.Id, microciclo.Id);
        }

        [Fact]
        public async Task Delete_ExistingPlan_RemovesPlanAndCascadesChildren()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, _, planId, _) = await SeedPlanAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new DeleteSeasonPlanHandler(db);

            await handler.Handle(new DeleteSeasonPlanCommand(planId, userId), CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            Assert.False(await verifyDb.SeasonPlans.AnyAsync(sp => sp.Id == planId));
            Assert.False(await verifyDb.Macrociclos.AnyAsync(m => m.SeasonPlanId == planId));
        }

        [Fact]
        public async Task Delete_PlanWithLinkedSession_ClearsMicrocicloIdButKeepsSession()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, teamId, planId, microcicloId) = await SeedPlanAsync(seedDb);

            var session = new TrainingSession { Name = "Sesion vinculada", TeamId = teamId, Date = DateTime.UtcNow, MicrocicloId = microcicloId };
            seedDb.TrainingSessions.Add(session);
            await seedDb.SaveChangesAsync();

            await using var db = _fixture.CreateDbContext();
            var handler = new DeleteSeasonPlanHandler(db);

            await handler.Handle(new DeleteSeasonPlanCommand(planId, userId), CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var persistedSession = await verifyDb.TrainingSessions.SingleAsync(s => s.Id == session.Id);
            Assert.Null(persistedSession.MicrocicloId);
        }

        [Fact]
        public async Task Delete_UnknownSeasonPlanId_ThrowsSeasonPlanNotFound()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, _, _, _) = await SeedPlanAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new DeleteSeasonPlanHandler(db);

            var ex = await Assert.ThrowsAsync<DomainException>(
                () => handler.Handle(new DeleteSeasonPlanCommand(Guid.NewGuid().ToString(), userId), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.SeasonPlanNotFound, ex.Code);
        }

        [Fact]
        public async Task Delete_UserWithoutAccess_ThrowsSeasonPlanAccessDenied()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (_, _, _, planId, _) = await SeedPlanAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new DeleteSeasonPlanHandler(db);

            var ex = await Assert.ThrowsAsync<DomainException>(
                () => handler.Handle(new DeleteSeasonPlanCommand(planId, $"stranger-{Guid.NewGuid():N}"), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.SeasonPlanAccessDenied, ex.Code);
        }
    }
}
