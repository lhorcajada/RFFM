#nullable enable
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
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
    /// Integration tests for GET /api/game-models (<see cref="GetGameModel.GameModelQuery"/>),
    /// covering team-access resolution for roles linked at team level (Player/FamilyMember via
    /// UserTeam) rather than club level (Coach/ClubDirector via UserClubs).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class GetGameModelHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetGameModelHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string CoachUserId, string TeamId)> SeedTeamWithGameModelAsync(AppDbContext db)
        {
            var club = Club.Create($"GetGameModel Test Club {Guid.NewGuid():N}", 1);
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
                Name = "GetGameModel Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var coachUserId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(coachUserId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var createHandler = new CreateGameModelHandler(db);
            var command = new CreateGameModelCommand(
                team.Id, "Modelo de prueba", "2025-2026",
                new List<PrincipleRequest>(),
                new List<SetPieceRuleRequest>(),
                new List<OpenIssueRequest>())
            { UserId = coachUserId };
            await createHandler.Handle(command, CancellationToken.None);

            return (coachUserId, team.Id);
        }

        [Fact]
        public async Task Handle_WhenUserIsPlayerLinkedViaUserTeamOnly_ReturnsModel()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (_, teamId) = await SeedTeamWithGameModelAsync(seedDb);

            var playerUserId = $"player-{Guid.NewGuid():N}";
            seedDb.UserTeams.Add(new UserTeam(playerUserId, teamId, Membership.Player.Id));
            await seedDb.SaveChangesAsync();

            await using var db = _fixture.CreateDbContext();
            var handler = new GetGameModel.Handler(db);

            var result = await handler.Handle(
                new GetGameModel.GameModelQuery(teamId, "2025-2026", playerUserId), CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal("Modelo de prueba", result!.Name);
        }

        [Fact]
        public async Task Handle_WhenUserHasNoClubOrTeamLink_ThrowsTeamAccessDenied()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (_, teamId) = await SeedTeamWithGameModelAsync(seedDb);

            var strangerUserId = $"stranger-{Guid.NewGuid():N}";

            await using var db = _fixture.CreateDbContext();
            var handler = new GetGameModel.Handler(db);

            await Assert.ThrowsAsync<RFFM.Api.Domain.DomainException>(async () =>
                await handler.Handle(
                    new GetGameModel.GameModelQuery(teamId, "2025-2026", strangerUserId), CancellationToken.None));
        }
    }
}
