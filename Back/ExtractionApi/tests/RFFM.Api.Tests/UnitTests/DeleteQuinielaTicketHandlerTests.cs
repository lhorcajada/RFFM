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
    public class DeleteQuinielaTicketHandlerTests(PostgresContainerFixture fixture)
    {
        private static DeleteQuinielaTicket.Handler Handler(AppDbContext db, string? userId) => new(db, User(userId));

        private async Task<(QuinielaSeed Seed, QuinielaJornada Jornada, QuinielaTicket Ticket)> SeedAsync(string suffix, bool paid = false)
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches(suffix));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            var ticket = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, suffix, QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, paid: paid);
            return (seed, jornada, ticket);
        }

        private static DeleteQuinielaTicket.Command Command(QuinielaSeed seed, QuinielaJornada jornada, QuinielaTicket ticket) =>
            new(seed.TeamId, jornada.Id, ticket.Id);

        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        public async Task Handle_ByTheCoach_RemovesThePendingOrPaidTicket(bool paid)
        {
            var (seed, jornada, ticket) = await SeedAsync($"d1{paid}", paid);
            await using var db = fixture.CreateDbContext();

            await Handler(db, seed.CoachId).Handle(Command(seed, jornada, ticket), CancellationToken.None);

            await using var verify = fixture.CreateDbContext();
            Assert.False(await verify.QuinielaTickets.AnyAsync(t => t.Id == ticket.Id));
        }

        [Theory]
        [InlineData("player")]
        [InlineData("family")]
        [InlineData("follower")]
        public async Task Handle_ByANonCoach_ThrowsForbidden(string who)
        {
            var (seed, jornada, ticket) = await SeedAsync($"d2{who}");
            var userId = who switch { "player" => seed.PlayerId, "family" => seed.FamilyId, _ => seed.FollowerId };
            await using var db = fixture.CreateDbContext();

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                Handler(db, userId).Handle(Command(seed, jornada, ticket), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Handle_UnknownTicket_ThrowsNotFound()
        {
            var (seed, jornada, _) = await SeedAsync("d3");
            await using var db = fixture.CreateDbContext();

            var ex = await Assert.ThrowsAsync<NotFoundException>(() =>
                Handler(db, seed.CoachId).Handle(new DeleteQuinielaTicket.Command(seed.TeamId, jornada.Id, "missing"), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaTicketNotFound, ex.Code);
        }

        [Fact]
        public async Task Handle_OnASettledJornada_IsRejectedAndKeepsTheTicket()
        {
            var (seed, jornada, ticket) = await SeedAsync("d4", paid: true);
            await using (var setup = fixture.CreateDbContext())
            {
                (await setup.QuinielaJornadas.SingleAsync(j => j.Id == jornada.Id)).Settle(0m, AfterMatches);
                await setup.SaveChangesAsync();
            }
            await using var db = fixture.CreateDbContext();

            var ex = await Assert.ThrowsAsync<DomainException>(() =>
                Handler(db, seed.CoachId).Handle(Command(seed, jornada, ticket), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaAlreadySettled, ex.Code);
            await using var verify = fixture.CreateDbContext();
            Assert.True(await verify.QuinielaTickets.AnyAsync(t => t.Id == ticket.Id));
        }
    }
}
