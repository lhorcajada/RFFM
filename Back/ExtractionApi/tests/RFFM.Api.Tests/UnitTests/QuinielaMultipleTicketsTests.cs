#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Features.Coaches.Quiniela;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.UnitTests.QuinielaTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class QuinielaMultipleTicketsTests(PostgresContainerFixture fixture)
    {
        private async Task<QuinielaCurrentDto> CurrentAsync(string teamId, string userId, DateTime now)
        {
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();
            return await new GetCurrentQuiniela.Handler(db, fed, User(userId), ClockAt(now))
                .Handle(new GetCurrentQuiniela.Query(teamId), CancellationToken.None);
        }

        [Fact]
        public void Ticket_Create_RejectsANumberBelowOne() =>
            Assert.Throws<DomainException>(() =>
                QuinielaTicket.Create("j", "u", [new QuinielaPick("A", QuinielaSign.Home)], 0, 0, number: 0));

        [Fact]
        public async Task Current_ReturnsAllMyTicketsInOrder_AndNotOthers()
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("t1"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "t1", QuinielaSign.Away, QuinielaSign.Away, QuinielaSign.Away, number: 2);
            await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "t1", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, number: 1);
            await SeedTicketAsync(fixture, jornada.Id, seed.FamilyId, "t1", QuinielaSign.Home, QuinielaSign.Home, QuinielaSign.Home);

            var dto = await CurrentAsync(seed.TeamId, seed.PlayerId, BeforeKickoff);

            Assert.Equal([1, 2], dto.MyTickets.Select(t => t.Number).ToArray());
        }

        [Fact]
        public async Task Current_CountsDistinctParticipants_NotTickets()
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("t2"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "t2", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, paid: true, number: 1);
            await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "t2", QuinielaSign.Away, QuinielaSign.Away, QuinielaSign.Away, paid: true, number: 2);
            await SeedTicketAsync(fixture, jornada.Id, seed.FamilyId, "t2", QuinielaSign.Home, QuinielaSign.Home, QuinielaSign.Home, number: 1);

            var dto = await CurrentAsync(seed.TeamId, seed.CoachId, BeforeKickoff);

            Assert.Equal(2, dto.Pool!.Participants);
            Assert.Equal(2, dto.Pool.PaidTickets);
            Assert.Equal(2m, dto.Pool.Collected);
        }

        [Fact]
        public async Task Payments_ListEveryTicketOfAUserWithItsNumber()
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("t3"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "t3", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, number: 1);
            await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "t3", QuinielaSign.Away, QuinielaSign.Away, QuinielaSign.Away, number: 2);
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var dto = await new GetQuinielaPayments.Handler(db, fed, User(seed.CoachId), ClockAt(BeforeKickoff))
                .Handle(new GetQuinielaPayments.Query(seed.TeamId, jornada.Id), CancellationToken.None);

            Assert.Equal([1, 2], dto.Tickets.OrderBy(t => t.Number).Select(t => t.Number).ToArray());
            Assert.All(dto.Tickets, t => Assert.Equal(seed.PlayerId, t.UserId));
        }

        private async Task<(QuinielaSeed Seed, QuinielaJornada Jornada)> SeedSettledWithTwoTicketsAsync(string suffix)
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches(suffix, "1-0", "1-1", "0-1"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            var first = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, suffix, QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, paid: true, number: 1);
            var second = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, suffix, QuinielaSign.Away, QuinielaSign.Away, QuinielaSign.Home, paid: true, number: 2);
            await using var setup = fixture.CreateDbContext();
            setup.UserPersonalData.Add(UserPersonalData.Create(seed.PlayerId, "Pablo", "Vega", null, null));
            (await setup.QuinielaJornadas.SingleAsync(j => j.Id == jornada.Id)).Settle(0m, AfterMatches);
            (await setup.QuinielaTickets.SingleAsync(t => t.Id == first.Id)).ApplyResult(1, QuinielaCategory.None, 0m);
            (await setup.QuinielaTickets.SingleAsync(t => t.Id == second.Id)).ApplyResult(3, QuinielaCategory.Special, 3m);
            await setup.SaveChangesAsync();
            return (seed, jornada);
        }

        [Fact]
        public async Task Previous_SummarisesTheBestResultAndTotalPrizeOfMyTickets()
        {
            var (seed, _) = await SeedSettledWithTwoTicketsAsync("t4");

            var previous = (await CurrentAsync(seed.TeamId, seed.PlayerId, AfterMatches)).Previous!;

            Assert.Equal(3, previous.MyHits);
            Assert.Equal("Special", previous.MyCategory);
            Assert.Equal(3m, previous.MyPrize);
        }

        [Fact]
        public async Task Previous_WinnersIdentifyTheWinningTicketNumber()
        {
            var (seed, _) = await SeedSettledWithTwoTicketsAsync("t5");

            var winner = Assert.Single((await CurrentAsync(seed.TeamId, seed.FamilyId, AfterMatches)).Previous!.Winners);

            Assert.Equal("Pablo Vega", winner.UserName);
            Assert.Equal(2, winner.TicketNumber);
        }
    }
}
