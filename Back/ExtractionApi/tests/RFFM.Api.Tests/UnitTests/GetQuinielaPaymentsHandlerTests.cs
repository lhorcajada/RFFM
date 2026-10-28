#nullable enable
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Features.Coaches.Quiniela;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.UnitTests.QuinielaTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetQuinielaPaymentsHandlerTests(PostgresContainerFixture fixture)
    {
        private static GetQuinielaPayments.Handler Handler(AppDbContext db, FederationDbContext fed, string? userId, DateTime? now = null) =>
            new(db, fed, User(userId), ClockAt(now ?? BeforeKickoff));

        private async Task<(QuinielaSeed Seed, QuinielaJornada Jornada)> SeedAsync(string suffix, decimal carryIn = 0m)
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches(suffix));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId, carryIn);
            await SeedTicketAsync(fixture, jornada.Id, seed.CoachId, suffix, QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, paid: true);
            await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, suffix, QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, paid: true);
            await SeedTicketAsync(fixture, jornada.Id, seed.FamilyId, suffix, QuinielaSign.Away, QuinielaSign.Draw, QuinielaSign.Away);
            return (seed, jornada);
        }

        [Fact]
        public async Task Handle_ReturnsTicketsAndTotals()
        {
            var (seed, jornada) = await SeedAsync("g1", carryIn: 2m);
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var dto = await Handler(db, fed, seed.CoachId).Handle(new GetQuinielaPayments.Query(seed.TeamId, jornada.Id), CancellationToken.None);

            Assert.Equal(3, dto.Tickets.Count);
            Assert.Equal(2m, dto.Totals.Collected);
            Assert.Equal(1m, dto.Totals.Pending);
            Assert.Equal(1.1m + 2m, dto.Totals.PrizePool);
            Assert.Equal(0.9m, dto.Totals.FundAmount);
            Assert.Equal(2m, dto.Totals.CarryIn);
            Assert.Equal(2, dto.Tickets.Count(t => t.PaymentStatus == "Paid"));
            Assert.Equal(1, dto.Tickets.Count(t => t.PaymentStatus == "Pending"));
        }

        [Fact]
        public async Task Handle_AfterTheDeadlineAPendingTicketIsExpiredAndNoLongerPending()
        {
            var (seed, jornada) = await SeedAsync("g2");
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var dto = await Handler(db, fed, seed.CoachId, AfterMatches).Handle(new GetQuinielaPayments.Query(seed.TeamId, jornada.Id), CancellationToken.None);

            Assert.Contains(dto.Tickets, t => t.PaymentStatus == "Expired");
            Assert.Equal(0m, dto.Totals.Pending);
        }

        [Theory]
        [InlineData("player")]
        [InlineData("family")]
        [InlineData("follower")]
        public async Task Handle_ByANonCoach_ThrowsForbidden(string who)
        {
            var (seed, jornada) = await SeedAsync($"g3{who}");
            var userId = who switch { "player" => seed.PlayerId, "family" => seed.FamilyId, _ => seed.FollowerId };
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                Handler(db, fed, userId).Handle(new GetQuinielaPayments.Query(seed.TeamId, jornada.Id), CancellationToken.None).AsTask());
        }

        [Theory]
        [InlineData("clubcoach")]
        [InlineData("directive")]
        public async Task Handle_ByAClubLevelCoachOrDirective_ReturnsTickets(string who)
        {
            var (seed, jornada) = await SeedAsync($"g4{who}");
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var dto = await Handler(db, fed, seed.ClubUser(who)).Handle(new GetQuinielaPayments.Query(seed.TeamId, jornada.Id), CancellationToken.None);

            Assert.Equal(3, dto.Tickets.Count);
        }

        [Fact]
        public async Task Handle_ByACoachOfAnotherClub_ThrowsForbidden()
        {
            var (seed, jornada) = await SeedAsync("g5");
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                Handler(db, fed, seed.OtherClubCoachId).Handle(new GetQuinielaPayments.Query(seed.TeamId, jornada.Id), CancellationToken.None).AsTask());
        }
    }
}
