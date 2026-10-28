#nullable enable
using Microsoft.EntityFrameworkCore;
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
    public class SetQuinielaTicketPaymentHandlerTests(PostgresContainerFixture fixture)
    {
        private static SetQuinielaTicketPayment.Handler Handler(AppDbContext db, string? userId) =>
            new(db, User(userId), ClockAt(BeforeKickoff));

        private async Task<(QuinielaSeed Seed, QuinielaJornada Jornada, QuinielaTicket Ticket)> SeedAsync(string suffix, bool paid = false)
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches(suffix));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            var ticket = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, suffix, QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, paid: paid);
            return (seed, jornada, ticket);
        }

        private static SetQuinielaTicketPayment.Command Command(QuinielaSeed seed, QuinielaJornada jornada, QuinielaTicket ticket, bool paid = true, string? method = "Cash") =>
            new() { TeamId = seed.TeamId, JornadaId = jornada.Id, TicketId = ticket.Id, Paid = paid, Method = method };

        [Fact]
        public async Task Handle_MarksTheTicketAsPaidWithMethodAndDate()
        {
            var (seed, jornada, ticket) = await SeedAsync("p1");
            await using var db = fixture.CreateDbContext();

            var dto = await Handler(db, seed.CoachId).Handle(Command(seed, jornada, ticket, method: "Bizum"), CancellationToken.None);

            Assert.Equal("Paid", dto.PaymentStatus);
            Assert.Equal("Bizum", dto.PaymentMethod);
            await using var verify = fixture.CreateDbContext();
            var stored = await verify.QuinielaTickets.SingleAsync(t => t.Id == ticket.Id);
            Assert.Equal(QuinielaPaymentStatus.Paid, stored.PaymentStatus);
            Assert.Equal(BeforeKickoff, stored.PaidAt);
        }

        [Fact]
        public async Task Handle_MarksAPaidTicketAsPendingAgain()
        {
            var (seed, jornada, ticket) = await SeedAsync("p2", paid: true);
            await using var db = fixture.CreateDbContext();

            var dto = await Handler(db, seed.CoachId).Handle(Command(seed, jornada, ticket, paid: false, method: null), CancellationToken.None);

            Assert.Equal("Pending", dto.PaymentStatus);
            await using var verify = fixture.CreateDbContext();
            var stored = await verify.QuinielaTickets.SingleAsync(t => t.Id == ticket.Id);
            Assert.Null(stored.PaidAt);
            Assert.Null(stored.PaymentMethod);
        }

        [Theory]
        [InlineData("player")]
        [InlineData("family")]
        [InlineData("follower")]
        public async Task Handle_ByANonCoach_ThrowsForbidden(string who)
        {
            var (seed, jornada, ticket) = await SeedAsync($"p3{who}");
            var userId = who switch { "player" => seed.PlayerId, "family" => seed.FamilyId, _ => seed.FollowerId };
            await using var db = fixture.CreateDbContext();

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                Handler(db, userId).Handle(Command(seed, jornada, ticket), CancellationToken.None).AsTask());
        }

        [Theory]
        [InlineData("clubcoach")]
        [InlineData("directive")]
        public async Task Handle_ByAClubLevelCoachOrDirective_MarksPaid(string who)
        {
            var (seed, jornada, ticket) = await SeedAsync($"p5{who}");
            await using var db = fixture.CreateDbContext();

            var dto = await Handler(db, seed.ClubUser(who)).Handle(Command(seed, jornada, ticket), CancellationToken.None);

            Assert.Equal("Paid", dto.PaymentStatus);
        }

        [Fact]
        public async Task Handle_ByACoachOfAnotherClub_ThrowsForbidden()
        {
            var (seed, jornada, ticket) = await SeedAsync("p6");
            await using var db = fixture.CreateDbContext();

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                Handler(db, seed.OtherClubCoachId).Handle(Command(seed, jornada, ticket), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Handle_TicketOfAnotherJornada_ThrowsNotFound()
        {
            var (seed, jornada, _) = await SeedAsync("p4");
            await using var db = fixture.CreateDbContext();

            var ex = await Assert.ThrowsAsync<NotFoundException>(() =>
                Handler(db, seed.CoachId).Handle(new SetQuinielaTicketPayment.Command
                {
                    TeamId = seed.TeamId, JornadaId = jornada.Id, TicketId = "missing", Paid = true, Method = "Cash"
                }, CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaTicketNotFound, ex.Code);
        }

        [Fact]
        public async Task Handle_OnASettledJornada_IsRejected()
        {
            var (seed, jornada, ticket) = await SeedAsync("p5");
            await using (var setup = fixture.CreateDbContext())
            {
                (await setup.QuinielaJornadas.SingleAsync(j => j.Id == jornada.Id)).Settle(0m, AfterMatches);
                await setup.SaveChangesAsync();
            }
            await using var db = fixture.CreateDbContext();

            var ex = await Assert.ThrowsAsync<DomainException>(() =>
                Handler(db, seed.CoachId).Handle(Command(seed, jornada, ticket), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaAlreadySettled, ex.Code);
        }

        private static readonly SetQuinielaTicketPayment.Validator Validator = new();

        [Theory]
        [InlineData(true, "Cash", true)]
        [InlineData(true, "Bizum", true)]
        [InlineData(true, null, false)]
        [InlineData(true, "Tarjeta", false)]
        [InlineData(false, null, true)]
        public void Validator_RequiresAKnownMethodWhenPaid(bool paid, string? method, bool valid) =>
            Assert.Equal(valid, Validator.Validate(new SetQuinielaTicketPayment.Command
            {
                TeamId = "t", JornadaId = "j", TicketId = "k", Paid = paid, Method = method
            }).IsValid);
    }
}
