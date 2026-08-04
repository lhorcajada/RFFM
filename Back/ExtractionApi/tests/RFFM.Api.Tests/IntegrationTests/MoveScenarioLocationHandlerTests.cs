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
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Integration tests for PATCH /api/game-models/scenarios/{scenarioId}/location
    /// (<see cref="MoveScenarioLocationCommand"/>), re-scoped to move a scenario to a different
    /// <see cref="GamePrinciple"/> within the same game model.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class MoveScenarioLocationHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public MoveScenarioLocationHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string UserId, string TeamId, string GameModelId, string ScenarioToMoveId, string SiblingRemainingId, string SourcePrincipleId, string TargetPrincipleId, string OtherModelPrincipleId)> SeedGameModelWithScenariosAsync(AppDbContext db)
        {
            var club = Club.Create($"Move Scenario Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Move Scenario Test Team",
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

            var sourcePrinciple = new GamePrinciple(model.Id, gameMomentId: 1, gameZoneId: 1, order: 1, "Principio origen", "");
            var targetPrinciple = new GamePrinciple(model.Id, gameMomentId: 2, gameZoneId: 2, order: 1, "Principio destino", "");

            // Scenario carrying nested content, to be moved from the source principle to the target principle.
            var scenarioToMove = new GameScenario(sourcePrinciple.Id, order: 1, "Escenario a mover", "Contexto");
            var subPrinciple = new SubPrinciple(scenarioToMove.Id, "A", "Subprincipio 1", "Contexto SP", order: 1);
            var subSubPrinciple = new SubSubPrinciple(subPrinciple.Id, "Sub-sub 1", "Accion 1", order: 1);
            var essentialSkill = new EssentialSkill(subSubPrinciple.Id, "Habilidad 1", "Descripcion habilidad 1");
            subSubPrinciple.EssentialSkills.Add(essentialSkill);
            subPrinciple.SubSubPrinciples.Add(subSubPrinciple);
            scenarioToMove.SubPrinciples.Add(subPrinciple);

            // Two siblings remaining in the source principle after the move, out of order to verify renumbering.
            var siblingRemaining1 = new GameScenario(sourcePrinciple.Id, order: 2, "Escenario restante 1", "Contexto");
            var siblingRemaining2 = new GameScenario(sourcePrinciple.Id, order: 3, "Escenario restante 2", "Contexto");

            // One existing scenario already in the target principle, so the moved scenario should land at order 2.
            var targetExisting = new GameScenario(targetPrinciple.Id, order: 1, "Escenario ya en destino", "Contexto");

            sourcePrinciple.Scenarios.Add(scenarioToMove);
            sourcePrinciple.Scenarios.Add(siblingRemaining1);
            sourcePrinciple.Scenarios.Add(siblingRemaining2);
            targetPrinciple.Scenarios.Add(targetExisting);

            model.Principles.Add(sourcePrinciple);
            model.Principles.Add(targetPrinciple);
            db.GameModels.Add(model);
            await db.SaveChangesAsync();

            // A principle belonging to a different game model, to verify cross-model rejection.
            var otherTeam = new Team(new TeamModelBase
            {
                Name = "Move Scenario Other Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(otherTeam);
            await db.SaveChangesAsync();

            var otherModel = new GameModel(otherTeam.Id, "Modelo de prueba 2", "2025-2026");
            var otherModelPrinciple = new GamePrinciple(otherModel.Id, gameMomentId: 1, gameZoneId: 1, order: 1, "Principio otro modelo", "");
            otherModel.Principles.Add(otherModelPrinciple);
            db.GameModels.Add(otherModel);
            await db.SaveChangesAsync();

            return (userId, team.Id, model.Id, scenarioToMove.Id, siblingRemaining1.Id, sourcePrinciple.Id, targetPrinciple.Id, otherModelPrinciple.Id);
        }

        [Fact]
        public async Task MovingToADifferentPrinciple_UpdatesLocationAndOrder_AndPreservesNestedContent()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, _, scenarioToMoveId, _, _, targetPrincipleId, _) = await SeedGameModelWithScenariosAsync(seedDb);

            await using var handleDb = _fixture.CreateDbContext();
            var handler = new MoveScenarioLocationHandler(handleDb);

            var command = new MoveScenarioLocationCommand(scenarioToMoveId, targetPrincipleId, userId);

            var result = await handler.Handle(command, CancellationToken.None);

            // The target principle already had one scenario (order 1), so the moved one should be order 2.
            Assert.Equal(2, result.Order);

            await using var verifyDb = _fixture.CreateDbContext();
            var moved = await verifyDb.GameScenarios
                .Include(s => s.SubPrinciples).ThenInclude(sp => sp.SubSubPrinciples).ThenInclude(ssp => ssp.EssentialSkills)
                .SingleAsync(s => s.Id == scenarioToMoveId);

            Assert.Equal(targetPrincipleId, moved.GamePrincipleId);
            Assert.Equal(2, moved.Order);

            var subPrinciple = Assert.Single(moved.SubPrinciples);
            Assert.Equal("Subprincipio 1", subPrinciple.Name);
            var subSubPrinciple = Assert.Single(subPrinciple.SubSubPrinciples);
            Assert.Equal("Sub-sub 1", subSubPrinciple.Name);
            var skill = Assert.Single(subSubPrinciple.EssentialSkills);
            Assert.Equal("Habilidad 1", skill.Name);
        }

        [Fact]
        public async Task MovingToADifferentPrinciple_RenumbersRemainingScenariosInSource()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, _, scenarioToMoveId, siblingRemainingId, sourcePrincipleId, targetPrincipleId, _) = await SeedGameModelWithScenariosAsync(seedDb);

            await using var handleDb = _fixture.CreateDbContext();
            var handler = new MoveScenarioLocationHandler(handleDb);

            var command = new MoveScenarioLocationCommand(scenarioToMoveId, targetPrincipleId, userId);
            await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var remaining = await verifyDb.GameScenarios
                .Where(s => s.GamePrincipleId == sourcePrincipleId)
                .OrderBy(s => s.Order)
                .ToListAsync();

            Assert.Equal(2, remaining.Count);
            Assert.Equal(new[] { 1, 2 }, remaining.Select(s => s.Order));
            Assert.Equal(siblingRemainingId, remaining[0].Id);
        }

        [Fact]
        public async Task RequestingCurrentPrinciple_IsNoOp()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, _, scenarioToMoveId, _, sourcePrincipleId, _, _) = await SeedGameModelWithScenariosAsync(seedDb);

            await using var handleDb = _fixture.CreateDbContext();
            var handler = new MoveScenarioLocationHandler(handleDb);

            var command = new MoveScenarioLocationCommand(scenarioToMoveId, sourcePrincipleId, userId);
            var result = await handler.Handle(command, CancellationToken.None);

            Assert.Equal(1, result.Order);

            await using var verifyDb = _fixture.CreateDbContext();
            var scenariosInSource = await verifyDb.GameScenarios
                .Where(s => s.GamePrincipleId == sourcePrincipleId)
                .OrderBy(s => s.Order)
                .ToListAsync();

            // No renumbering should have been triggered - all three scenarios still there with original orders.
            Assert.Equal(3, scenariosInSource.Count);
            Assert.Equal(new[] { 1, 2, 3 }, scenariosInSource.Select(s => s.Order));
        }

        [Fact]
        public async Task UnknownScenarioId_ThrowsGameModelNotFound()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, _, _, _, _, targetPrincipleId, _) = await SeedGameModelWithScenariosAsync(seedDb);

            await using var handleDb = _fixture.CreateDbContext();
            var handler = new MoveScenarioLocationHandler(handleDb);

            var command = new MoveScenarioLocationCommand(Guid.NewGuid().ToString(), targetPrincipleId, userId);

            var ex = await Assert.ThrowsAsync<DomainException>(() => handler.Handle(command, CancellationToken.None).AsTask());
            Assert.Equal(ErrorCodes.GameModelNotFound, ex.Code);
        }

        [Fact]
        public async Task UnknownTargetPrincipleId_ThrowsGameModelNotFound()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, _, scenarioToMoveId, _, _, _, _) = await SeedGameModelWithScenariosAsync(seedDb);

            await using var handleDb = _fixture.CreateDbContext();
            var handler = new MoveScenarioLocationHandler(handleDb);

            var command = new MoveScenarioLocationCommand(scenarioToMoveId, Guid.NewGuid().ToString(), userId);

            var ex = await Assert.ThrowsAsync<DomainException>(() => handler.Handle(command, CancellationToken.None).AsTask());
            Assert.Equal(ErrorCodes.GameModelNotFound, ex.Code);
        }

        [Fact]
        public async Task TargetPrincipleInDifferentGameModel_IsRejected()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, _, scenarioToMoveId, _, _, _, otherModelPrincipleId) = await SeedGameModelWithScenariosAsync(seedDb);

            await using var handleDb = _fixture.CreateDbContext();
            var handler = new MoveScenarioLocationHandler(handleDb);

            var command = new MoveScenarioLocationCommand(scenarioToMoveId, otherModelPrincipleId, userId);

            var ex = await Assert.ThrowsAsync<DomainException>(() => handler.Handle(command, CancellationToken.None).AsTask());
            Assert.Equal(ErrorCodes.GameModelNotFound, ex.Code);
        }

        [Fact]
        public async Task UserWithoutAccess_ThrowsGameModelAccessDenied()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (_, _, _, scenarioToMoveId, _, _, targetPrincipleId, _) = await SeedGameModelWithScenariosAsync(seedDb);

            await using var handleDb = _fixture.CreateDbContext();
            var handler = new MoveScenarioLocationHandler(handleDb);

            var unauthorizedUserId = $"stranger-{Guid.NewGuid():N}";
            var command = new MoveScenarioLocationCommand(scenarioToMoveId, targetPrincipleId, unauthorizedUserId);

            var ex = await Assert.ThrowsAsync<DomainException>(() => handler.Handle(command, CancellationToken.None).AsTask());
            Assert.Equal(ErrorCodes.GameModelAccessDenied, ex.Code);
        }

        [Theory]
        [InlineData("", "principle-id")]
        [InlineData("scenario-id", "")]
        public void Validator_RejectsInvalidInput(string scenarioId, string targetPrincipleId)
        {
            var validator = new MoveScenarioLocationValidator();
            var command = new MoveScenarioLocationCommand(scenarioId, targetPrincipleId, "user-id");

            var result = validator.Validate(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validator_AcceptsValidInput()
        {
            var validator = new MoveScenarioLocationValidator();
            var command = new MoveScenarioLocationCommand("scenario-id", "principle-id", "user-id");

            var result = validator.Validate(command);

            Assert.True(result.IsValid);
        }
    }
}
