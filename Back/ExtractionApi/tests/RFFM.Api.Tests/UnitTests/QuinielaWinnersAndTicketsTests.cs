#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Features.Coaches.Quiniela;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.UnitTests.QuinielaTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class QuinielaWinnersAndTicketsTests(PostgresContainerFixture fixture)
    {
        private async Task<QuinielaCurrentDto> CurrentAsync(string teamId, string userId, DateTime? now = null)
        {
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();
            return await new GetCurrentQuiniela.Handler(db, fed, User(userId), ClockAt(now ?? AfterMatches))
                .Handle(new GetCurrentQuiniela.Query(teamId), CancellationToken.None);
        }

        private async Task<(QuinielaSeed Seed, QuinielaJornada Jornada, QuinielaTicket Player, QuinielaTicket Family)> SeedSettledAsync(
            string suffix, QuinielaCategory playerCategory, QuinielaCategory familyCategory, decimal carryOut = 0m)
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches(suffix, "1-0", "1-1", "0-1"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            var player = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, suffix, QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, paid: true);
            var family = await SeedTicketAsync(fixture, jornada.Id, seed.FamilyId, suffix, QuinielaSign.Away, QuinielaSign.Away, QuinielaSign.Home, paid: true);
            await using var setup = fixture.CreateDbContext();
            setup.UserPersonalData.Add(UserPersonalData.Create(seed.PlayerId, "Pablo", "Vega", null, null));
            setup.UserPersonalData.Add(UserPersonalData.Create(seed.FamilyId, "Carla", "Ruiz", null, null));
            (await setup.QuinielaJornadas.SingleAsync(j => j.Id == jornada.Id)).Settle(carryOut, AfterMatches);
            (await setup.QuinielaTickets.SingleAsync(t => t.Id == player.Id)).ApplyResult(3, playerCategory, playerCategory == QuinielaCategory.None ? 0m : 3m);
            (await setup.QuinielaTickets.SingleAsync(t => t.Id == family.Id)).ApplyResult(0, familyCategory, familyCategory == QuinielaCategory.None ? 0m : 1m);
            await setup.SaveChangesAsync();
            return (seed, jornada, player, family);
        }

        [Fact]
        public async Task Current_AfterSettling_ListsTheWinnersForAnyParticipant()
        {
            var (seed, _, _, _) = await SeedSettledAsync("w1", QuinielaCategory.Special, QuinielaCategory.None);

            var dto = await CurrentAsync(seed.TeamId, seed.FamilyId);

            var winner = Assert.Single(dto.Previous!.Winners);
            Assert.Equal("Pablo Vega", winner.UserName);
            Assert.Equal("Special", winner.Category);
            Assert.Equal(3, winner.Hits);
            Assert.Equal(3m, winner.Prize);
        }

        [Fact]
        public async Task Current_AfterSettling_OrdersWinnersByCategoryThenPrize()
        {
            var (seed, _, _, _) = await SeedSettledAsync("w2", QuinielaCategory.Second, QuinielaCategory.First);

            var dto = await CurrentAsync(seed.TeamId, seed.CoachId);

            Assert.Equal(["Carla Ruiz", "Pablo Vega"], dto.Previous!.Winners.Select(w => w.UserName).ToArray());
        }

        [Fact]
        public async Task Current_AfterSettlingWithoutWinners_HasNoWinnersAndKeepsTheCarryOut()
        {
            var (seed, _, _, _) = await SeedSettledAsync("w3", QuinielaCategory.None, QuinielaCategory.None, carryOut: 2m);

            var dto = await CurrentAsync(seed.TeamId, seed.PlayerId);

            Assert.Empty(dto.Previous!.Winners);
            Assert.Equal(2m, dto.Previous.CarryOut);
        }

        [Fact]
        public async Task Payments_IncludeThePicksPlenoAndMatchesOfEachTicket()
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("w4"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "w4", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, plenoHome: 2, plenoAway: 3);
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var dto = await new GetQuinielaPayments.Handler(db, fed, User(seed.CoachId), ClockAt(BeforeKickoff))
                .Handle(new GetQuinielaPayments.Query(seed.TeamId, jornada.Id), CancellationToken.None);

            var ticket = Assert.Single(dto.Tickets);
            Assert.Equal(2, ticket.PlenoHome);
            Assert.Equal(3, ticket.PlenoAway);
            Assert.Equal(
                [("Aw4", "1"), ("Bw4", "X"), ("Cw4", "2")],
                ticket.Picks.OrderBy(p => p.RecordCode).Select(p => (p.RecordCode, p.Sign)).ToArray());
            Assert.Equal(3, dto.Matches.Count);
            Assert.Equal("Cw4", Assert.Single(dto.Matches, m => m.IsPleno).RecordCode);
        }

        private async Task<(QuinielaSeed Seed, QuinielaJornada Jornada)> SeedPaidAndPendingAsync(string suffix)
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches(suffix));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId, carryIn: 1m);
            await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, suffix, QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, paid: true);
            await SeedTicketAsync(fixture, jornada.Id, seed.FamilyId, suffix, QuinielaSign.Away, QuinielaSign.Away, QuinielaSign.Home);
            return (seed, jornada);
        }

        [Fact]
        public async Task Payments_PossiblePrizePool_CountsPaidAndPendingTickets()
        {
            var (seed, jornada) = await SeedPaidAndPendingAsync("p1");
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var dto = await new GetQuinielaPayments.Handler(db, fed, User(seed.CoachId), ClockAt(BeforeKickoff))
                .Handle(new GetQuinielaPayments.Query(seed.TeamId, jornada.Id), CancellationToken.None);

            Assert.Equal(1.55m, dto.Totals.PrizePool);
            Assert.Equal(2.10m, dto.Totals.PossiblePrizePool);
        }

        [Fact]
        public async Task Current_PossiblePrizePool_CountsPaidAndPendingTickets()
        {
            var (seed, _) = await SeedPaidAndPendingAsync("p2");

            var dto = await CurrentAsync(seed.TeamId, seed.PlayerId, BeforeKickoff);

            Assert.Equal(1.55m, dto.Pool!.PrizePool);
            Assert.Equal(2.10m, dto.Pool.PossiblePrizePool);
        }

        [Fact]
        public async Task Current_PossiblePrizePool_IgnoresExpiredTickets()
        {
            var (seed, _) = await SeedPaidAndPendingAsync("p3");

            var dto = await CurrentAsync(seed.TeamId, seed.PlayerId, AfterMatches);

            Assert.Equal(dto.Pool!.PrizePool, dto.Pool.PossiblePrizePool);
        }
    }
}
