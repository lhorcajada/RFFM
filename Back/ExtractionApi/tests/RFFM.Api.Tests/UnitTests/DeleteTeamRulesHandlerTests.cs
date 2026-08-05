#nullable enable
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Mobile.Teams.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class DeleteTeamRulesHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public DeleteTeamRulesHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<string> SeedTeamAsync(AppDbContext db, bool withRulesSet)
        {
            var club = Club.Create($"Delete Rules Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Delete Rules Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            if (withRulesSet)
            {
                var rulesSet = TeamRulesSet.Create(team.Id, "Titulo", "Subtitulo", "Nota inicial", null, null);
                rulesSet.ReplaceRules(new[] { new TeamRuleInput(null, "Regla", null, "V", "C", null, null, null) });
                db.TeamRulesSets.Add(rulesSet);
                await db.SaveChangesAsync();
            }

            return team.Id;
        }

        [Fact]
        public async Task Handle_ExistingRulesSet_RemovesItAndCascadesRules()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db, withRulesSet: true);

            var handler = new DeleteTeamRules.Handler(db);
            await handler.Handle(new DeleteTeamRules.DeleteTeamRulesCommand { TeamId = teamId }, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var setExists = await verifyDb.TeamRulesSets.AnyAsync(rs => rs.TeamId == teamId);
            var rulesExist = await verifyDb.TeamRules.AnyAsync(r => r.TeamRulesSet.TeamId == teamId);
            Assert.False(setExists);
            Assert.False(rulesExist);
        }

        [Fact]
        public async Task Handle_NoExistingRulesSet_IsNoOp()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db, withRulesSet: false);

            var handler = new DeleteTeamRules.Handler(db);
            var exception = await Record.ExceptionAsync(
                () => handler.Handle(new DeleteTeamRules.DeleteTeamRulesCommand { TeamId = teamId }, CancellationToken.None).AsTask());

            Assert.Null(exception);
        }

        [Fact]
        public async Task Handle_TeamDoesNotExist_ThrowsNotFoundException()
        {
            await using var db = _fixture.CreateDbContext();

            var handler = new DeleteTeamRules.Handler(db);

            await Assert.ThrowsAsync<NotFoundException>(
                () => handler.Handle(new DeleteTeamRules.DeleteTeamRulesCommand { TeamId = "non-existent-team-id" }, CancellationToken.None).AsTask());
        }
    }
}
