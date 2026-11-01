#nullable enable
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Features.Coaches.Quiniela;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.UnitTests.QuinielaTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetQuinielaJornadaResultsHandlerTests(PostgresContainerFixture fixture)
    {
        // Resultados: A 1-0 (1), B 1-1 (X), C 0-1 (2, Pleno 0-1).
        private async Task<(QuinielaSeed Seed, QuinielaJornada Jornada, QuinielaTicket PlayerTicket)> SeedSettledAsync(string suffix, bool settle = true)
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches(suffix, "1-0", "1-1", "0-1"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            var playerTicket = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, suffix, QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, 0, 1, paid: true);
            await SeedTicketAsync(fixture, jornada.Id, seed.CoachId, suffix, QuinielaSign.Away, QuinielaSign.Home, QuinielaSign.Home, paid: true);

            if (settle)
            {
                await using var db = fixture.CreateDbContext();
                await using var fed = fixture.CreateFederationDbContext();
                await new SettleQuiniela.Handler(db, fed, User(seed.CoachId), ClockAt(AfterMatches))
                    .Handle(new SettleQuiniela.Command(seed.TeamId, jornada.Id), CancellationToken.None);
            }

            return (seed, jornada, playerTicket);
        }

        private async Task<QuinielaJornadaResultsDto> ResultsAsync(QuinielaSeed seed, QuinielaJornada jornada, string userId)
        {
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();
            return await new GetQuinielaJornadaResults.Handler(db, fed, User(userId))
                .Handle(new GetQuinielaJornadaResults.Query(seed.TeamId, jornada.Id), CancellationToken.None);
        }

        [Fact]
        public async Task Handle_FailsWhileTheJornadaIsNotSettled()
        {
            var (seed, jornada, _) = await SeedSettledAsync("r1", settle: false);

            var error = await Assert.ThrowsAsync<DomainException>(() => ResultsAsync(seed, jornada, seed.CoachId));

            Assert.Equal(ErrorCodes.QuinielaNotSettled, error.Code);
        }

        [Fact]
        public async Task Handle_ReturnsEveryTicketWithItsHitsToTheCoach()
        {
            var (seed, jornada, playerTicket) = await SeedSettledAsync("r2");

            var dto = await ResultsAsync(seed, jornada, seed.CoachId);

            Assert.Equal(2, dto.Tickets.Count);
            Assert.Equal(1, dto.RoundNumber);
            var winner = Assert.Single(dto.Tickets, t => t.Id == playerTicket.Id);
            Assert.Equal((3, "Special"), (winner.Hits, winner.Category));
            Assert.Equal(3, winner.Picks.Count);
        }

        [Fact]
        public async Task Handle_ReturnsTheFinalScoreOfEachMatch()
        {
            var (seed, jornada, _) = await SeedSettledAsync("r3");

            var dto = await ResultsAsync(seed, jornada, seed.CoachId);

            Assert.All(dto.Matches.Where(m => m.IsValid), m => Assert.True(m.IsFinal && m.HomeGoals is not null && m.AwayGoals is not null));
        }

        [Fact]
        public async Task Handle_ReturnsOnlyTheirOwnTicketsToAPlayer()
        {
            var (seed, jornada, playerTicket) = await SeedSettledAsync("r4");

            var dto = await ResultsAsync(seed, jornada, seed.PlayerId);

            var own = Assert.Single(dto.Tickets);
            Assert.Equal(playerTicket.Id, own.Id);
        }
    }
}
