#nullable enable
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Mobile.Teams.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetTeamRulesHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetTeamRulesHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<string> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"Team Rules Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Team Rules Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return team.Id;
        }

        [Fact]
        public async Task Handle_RulesSetExists_ReturnsOrderedDto()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db);

            var rulesSet = TeamRulesSet.Create(teamId, "Titulo", "Subtitulo", "Nota inicial", "Nota cierre", "Nota aplicacion");
            rulesSet.ReplaceRules(new[]
            {
                new TeamRuleInput(null, "Segunda", null, "V2", "C2", null, null, null),
                new TeamRuleInput(null, "Primera", null, "V1", "C1", null, new List<string> { "B1", "B2" }, "Detalle")
            });
            db.TeamRulesSets.Add(rulesSet);
            await db.SaveChangesAsync();

            var handler = new GetTeamRules.Handler(db);
            var query = new GetTeamRules.GetTeamRulesQuery { TeamId = teamId };

            var result = await handler.Handle(query, CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal(teamId, result!.TeamId);
            Assert.Equal("Titulo", result.Title);
            Assert.Equal(2, result.Rules.Count);
            Assert.Equal(1, result.Rules[0].Order);
            Assert.Equal("Segunda", result.Rules[0].ShortTitle);
            Assert.Equal(2, result.Rules[1].Order);
            Assert.Equal("Primera", result.Rules[1].ShortTitle);
            Assert.Equal(new List<string> { "B1", "B2" }, result.Rules[1].BulletPoints);
            Assert.Equal("Detalle", result.Rules[1].ConsequenceDetail);
        }

        [Fact]
        public async Task Handle_NoRulesSet_ReturnsNull()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db);

            var handler = new GetTeamRules.Handler(db);
            var query = new GetTeamRules.GetTeamRulesQuery { TeamId = teamId };

            var result = await handler.Handle(query, CancellationToken.None);

            Assert.Null(result);
        }

        [Fact]
        public async Task Handle_TeamDoesNotExist_ThrowsNotFoundException()
        {
            await using var db = _fixture.CreateDbContext();

            var handler = new GetTeamRules.Handler(db);
            var query = new GetTeamRules.GetTeamRulesQuery { TeamId = "non-existent-team-id" };

            await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(query, CancellationToken.None).AsTask());
        }
    }
}
