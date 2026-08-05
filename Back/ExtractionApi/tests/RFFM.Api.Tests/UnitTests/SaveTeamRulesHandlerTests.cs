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
using RFFM.Api.Features.Mobile.Teams.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class SaveTeamRulesHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public SaveTeamRulesHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<string> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"Save Rules Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Save Rules Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return team.Id;
        }

        private static SaveTeamRules.SaveTeamRulesCommand Command(string teamId, params SaveTeamRules.SaveTeamRuleRequest[] rules) =>
            new()
            {
                TeamId = teamId,
                Title = "Titulo",
                Subtitle = "Subtitulo",
                IntroNote = "Nota inicial",
                ClosingNote = "Nota cierre",
                ApplicationNote = "Nota aplicacion",
                Rules = rules.ToList()
            };

        private static SaveTeamRules.SaveTeamRuleRequest Rule(string shortTitle) =>
            new()
            {
                ShortTitle = shortTitle,
                ViolationSummary = "Violacion",
                ConsequenceSummary = "Consecuencia"
            };

        [Fact]
        public async Task Handle_NoExistingRulesSet_CreatesOne()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db);

            var handler = new SaveTeamRules.Handler(db);
            var result = await handler.Handle(Command(teamId, Rule("Regla 1"), Rule("Regla 2")), CancellationToken.None);

            Assert.Equal(teamId, result.TeamId);
            Assert.Equal(2, result.Rules.Count);

            await using var verifyDb = _fixture.CreateDbContext();
            var persisted = await verifyDb.TeamRulesSets
                .Include(rs => rs.Rules)
                .SingleAsync(rs => rs.TeamId == teamId);
            Assert.Equal(2, persisted.Rules.Count);
        }

        [Fact]
        public async Task Handle_ExistingRulesSet_ReplacesMetadataAndRules()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db);

            var handler = new SaveTeamRules.Handler(db);
            await handler.Handle(Command(teamId, Rule("Original 1"), Rule("Original 2")), CancellationToken.None);

            await using var db2 = _fixture.CreateDbContext();
            var handler2 = new SaveTeamRules.Handler(db2);
            var updateCommand = Command(teamId, Rule("Nueva unica"));
            updateCommand = updateCommand with { Title = "Titulo actualizado" };

            var result = await handler2.Handle(updateCommand, CancellationToken.None);

            Assert.Equal("Titulo actualizado", result.Title);
            Assert.Single(result.Rules);
            Assert.Equal("Nueva unica", result.Rules[0].ShortTitle);

            await using var verifyDb = _fixture.CreateDbContext();
            var persisted = await verifyDb.TeamRulesSets
                .Include(rs => rs.Rules)
                .SingleAsync(rs => rs.TeamId == teamId);
            Assert.Single(persisted.Rules);
        }

        [Fact]
        public async Task Handle_ReDerivesContiguousOrderFromArrayPosition()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db);

            var handler = new SaveTeamRules.Handler(db);
            var result = await handler.Handle(Command(teamId, Rule("A"), Rule("B"), Rule("C")), CancellationToken.None);

            Assert.Equal(new[] { 1, 2, 3 }, result.Rules.Select(r => r.Order));
            Assert.Equal(new[] { "A", "B", "C" }, result.Rules.Select(r => r.ShortTitle));
        }

        [Fact]
        public async Task Handle_TeamDoesNotExist_ThrowsNotFoundException()
        {
            await using var db = _fixture.CreateDbContext();

            var handler = new SaveTeamRules.Handler(db);

            await Assert.ThrowsAsync<NotFoundException>(
                () => handler.Handle(Command("non-existent-team-id", Rule("A")), CancellationToken.None).AsTask());
        }
    }
}
