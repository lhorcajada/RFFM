#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Features.Coaches.Quiniela;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.UnitTests.QuinielaTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class QuinielaLifecycleTests(PostgresContainerFixture fixture)
    {
        private async Task<bool> IsCompleteAsync(string groupCode, params RffmMatchSnapshot[] matches)
        {
            var roundId = await SeedRoundAsync(fixture, groupCode, 1, matches);
            await using var fed = fixture.CreateFederationDbContext();
            var round = await QuinielaSupport.LoadRoundAsync(fed, roundId, CancellationToken.None);
            return round.IsComplete;
        }

        private string NewGroup() => Random.Shared.Next(100_000, int.MaxValue).ToString();

        [Fact]
        public async Task IsComplete_WithAllValidMatchesFinal_IsTrue() =>
            Assert.True(await IsCompleteAsync(NewGroup(), StandardMatches("l1", "1-0", "1-1", "0-1")));

        [Fact]
        public async Task IsComplete_WithAPendingValidMatch_IsFalse() =>
            Assert.False(await IsCompleteAsync(NewGroup(), StandardMatches("l2", "1-0", "1-1")));

        [Fact]
        public async Task IsComplete_IgnoresPostponedMatches() =>
            Assert.True(await IsCompleteAsync(NewGroup(), StandardMatches("l3", "1-0", "1-1", "0-1", postponedD: true)));

        [Fact]
        public async Task IsComplete_WithoutValidMatches_IsFalse() =>
            Assert.False(await IsCompleteAsync(NewGroup(), Match("Z1", "07/11/2026", "16:00", statusReason: "Aplazado")));

        [Fact]
        public async Task SettleAsync_AppliesScoringAndCreatesTheFundMovement()
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("l4", "1-0", "1-1", "0-1"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            var winner = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "l4", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, 0, 1, paid: true);
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();
            var tracked = await db.QuinielaJornadas.SingleAsync(j => j.Id == jornada.Id);
            var round = await QuinielaSupport.LoadRoundAsync(fed, roundId, CancellationToken.None);

            var dto = await QuinielaLifecycle.SettleAsync(db, tracked, round, AfterMatches, CancellationToken.None);

            Assert.Equal(1m, dto.Collected);
            await using var verify = fixture.CreateDbContext();
            Assert.Equal(QuinielaJornadaStatus.Settled, (await verify.QuinielaJornadas.SingleAsync(j => j.Id == jornada.Id)).Status);
            Assert.Equal(QuinielaCategory.Special, (await verify.QuinielaTickets.SingleAsync(t => t.Id == winner.Id)).Category);
            Assert.Single(await verify.TeamFundMovements.Where(m => m.TeamId == seed.TeamId).ToListAsync());
        }

        [Fact]
        public async Task OpenNextAsync_OpensTheNextRoundWithTheCarryOverOfTheSettledJornada()
        {
            var seed = await SeedTeamAsync(fixture);
            var round1 = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("l5a", "1-0", "1-1", "0-1"));
            var round2 = await SeedRoundAsync(fixture, seed.GroupCode, 2, StandardMatches("l5b"));
            var previous = await SeedJornadaAsync(fixture, seed.TeamId, round1);
            await using (var setup = fixture.CreateDbContext())
            {
                (await setup.QuinielaJornadas.SingleAsync(j => j.Id == previous.Id)).Settle(2.5m, AfterMatches);
                await setup.SaveChangesAsync();
            }
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var dto = await QuinielaLifecycle.OpenNextAsync(db, fed, seed.TeamId, AfterMatches, CancellationToken.None);

            Assert.NotNull(dto);
            Assert.Equal(round2, dto!.RffmRoundId);
            Assert.Equal(2.5m, dto.CarryIn);
            Assert.Equal("Open", dto.Status);
        }

        [Fact]
        public async Task OpenNextAsync_WithoutANextRoundWithPendingMatches_ReturnsNullAndOpensNothing()
        {
            var seed = await SeedTeamAsync(fixture);
            var round1 = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("l6", "1-0", "1-1", "0-1"));
            var previous = await SeedJornadaAsync(fixture, seed.TeamId, round1);
            await using (var setup = fixture.CreateDbContext())
            {
                (await setup.QuinielaJornadas.SingleAsync(j => j.Id == previous.Id)).Settle(0m, AfterMatches);
                await setup.SaveChangesAsync();
            }
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var dto = await QuinielaLifecycle.OpenNextAsync(db, fed, seed.TeamId, AfterMatches, CancellationToken.None);

            Assert.Null(dto);
            await using var verify = fixture.CreateDbContext();
            Assert.Equal(1, await verify.QuinielaJornadas.CountAsync(j => j.TeamId == seed.TeamId));
        }
    }
}
