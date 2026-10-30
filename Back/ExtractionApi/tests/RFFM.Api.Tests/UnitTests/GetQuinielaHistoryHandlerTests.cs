#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Features.Coaches.Quiniela;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.UnitTests.QuinielaTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetQuinielaHistoryHandlerTests(PostgresContainerFixture fixture)
    {
        private async Task<QuinielaHistoryDto> HistoryAsync(string teamId, string? userId, int? limit = null, int? offset = null)
        {
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();
            return await new GetQuinielaHistory.Handler(db, fed, User(userId))
                .Handle(new GetQuinielaHistory.Query(teamId, limit, offset), CancellationToken.None);
        }

        private async Task<QuinielaJornada> SeedSettledAsync(
            QuinielaSeed seed, int roundNumber, string suffix, DateTime settledAt, decimal carryOut = 0m,
            Func<QuinielaJornada, Task>? tickets = null)
        {
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, roundNumber, StandardMatches(suffix, "1-0", "1-1", "0-1"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            if (tickets is not null)
                await tickets(jornada);
            await using var db = fixture.CreateDbContext();
            (await db.QuinielaJornadas.SingleAsync(j => j.Id == jornada.Id)).Settle(carryOut, settledAt);
            await db.SaveChangesAsync();
            return jornada;
        }

        private async Task ApplyResultAsync(string ticketId, int hits, QuinielaCategory category, decimal prize)
        {
            await using var db = fixture.CreateDbContext();
            (await db.QuinielaTickets.SingleAsync(t => t.Id == ticketId)).ApplyResult(hits, category, prize);
            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task Handle_ListsSettledJornadasMostRecentFirstWithTheirWinners()
        {
            var seed = await SeedTeamAsync(fixture);
            await SeedSettledAsync(seed, 1, "h1a", AfterMatches.AddDays(-7));
            await SeedSettledAsync(seed, 2, "h1b", AfterMatches, carryOut: 1.25m, tickets: async j =>
            {
                var winner = await SeedTicketAsync(fixture, j.Id, seed.PlayerId, "h1b", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, paid: true);
                await SeedTicketAsync(fixture, j.Id, seed.CoachId, "h1b", QuinielaSign.Away, QuinielaSign.Home, QuinielaSign.Home, paid: true);
                await ApplyResultAsync(winner.Id, 3, QuinielaCategory.First, 0.75m);
            });

            var dto = await HistoryAsync(seed.TeamId, seed.PlayerId);

            Assert.Equal(2, dto.Total);
            Assert.Equal([2, 1], dto.Items.Select(i => i.RoundNumber));
            var latest = dto.Items[0];
            Assert.Equal(1.25m, latest.CarryOut);
            Assert.Equal(2m, latest.Collected);
            Assert.Equal(1.1m, latest.PrizePool);
            var winnerDto = Assert.Single(latest.Winners);
            Assert.Equal(("First", 3, 0.75m, true), (winnerDto.Category, winnerDto.Hits, winnerDto.Prize, winnerDto.IsMine));
        }

        [Fact]
        public async Task Handle_ReturnsTheCallersBestResultAndTotalPrize()
        {
            var seed = await SeedTeamAsync(fixture);
            await SeedSettledAsync(seed, 1, "h2", AfterMatches, tickets: async j =>
            {
                var best = await SeedTicketAsync(fixture, j.Id, seed.PlayerId, "h2", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, paid: true, number: 1);
                var other = await SeedTicketAsync(fixture, j.Id, seed.PlayerId, "h2", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Home, paid: true, number: 2);
                await ApplyResultAsync(best.Id, 3, QuinielaCategory.First, 1m);
                await ApplyResultAsync(other.Id, 2, QuinielaCategory.Second, 0.5m);
            });

            var item = Assert.Single((await HistoryAsync(seed.TeamId, seed.PlayerId)).Items);

            Assert.Equal((3, "First", 1.5m), (item.MyHits, item.MyCategory, item.MyPrize));
        }

        [Fact]
        public async Task Handle_ForAParticipantWithoutTickets_HasNoOwnResult()
        {
            var seed = await SeedTeamAsync(fixture);
            await SeedSettledAsync(seed, 1, "h3", AfterMatches);

            var item = Assert.Single((await HistoryAsync(seed.TeamId, seed.PlayerId)).Items);

            Assert.Equal((null, null, null), (item.MyHits, item.MyCategory, item.MyPrize));
            Assert.Empty(item.Winners);
        }

        [Fact]
        public async Task Handle_ExcludesTheOpenJornada()
        {
            var seed = await SeedTeamAsync(fixture);
            await SeedSettledAsync(seed, 1, "h4a", AfterMatches.AddDays(-7));
            var round2 = await SeedRoundAsync(fixture, seed.GroupCode, 2, StandardMatches("h4b"));
            await SeedJornadaAsync(fixture, seed.TeamId, round2);

            var dto = await HistoryAsync(seed.TeamId, seed.PlayerId);

            Assert.Equal(1, dto.Total);
            Assert.Equal(1, Assert.Single(dto.Items).RoundNumber);
        }

        [Fact]
        public async Task Handle_PaginatesWithDefaultAndMaximumSizes()
        {
            var seed = await SeedTeamAsync(fixture);
            for (var round = 1; round <= 12; round++)
                await SeedSettledAsync(seed, round, $"h5r{round}", AfterMatches.AddDays(round));

            var firstPage = await HistoryAsync(seed.TeamId, seed.PlayerId);
            var secondPage = await HistoryAsync(seed.TeamId, seed.PlayerId, limit: 10, offset: 10);
            var capped = await HistoryAsync(seed.TeamId, seed.PlayerId, limit: 500);

            Assert.Equal(12, firstPage.Total);
            Assert.Equal(10, firstPage.Items.Count);
            Assert.Equal(12, firstPage.Items[0].RoundNumber);
            Assert.Equal([2, 1], secondPage.Items.Select(i => i.RoundNumber));
            Assert.Equal(12, capped.Items.Count);
        }

        [Theory]
        [InlineData("follower")]
        [InlineData("outsider")]
        public async Task Handle_ByAFollowerOrAnOutsider_ThrowsForbidden(string who)
        {
            var seed = await SeedTeamAsync(fixture);
            var userId = who == "follower" ? seed.FollowerId : seed.OutsiderId;

            await Assert.ThrowsAsync<ForbiddenAccessException>(() => HistoryAsync(seed.TeamId, userId));
        }
    }
}
