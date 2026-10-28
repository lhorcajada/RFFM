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
    public class DeleteMyQuinielaTicketHandlerTests(PostgresContainerFixture fixture)
    {
        private static DeleteMyQuinielaTicket.Handler Handler(AppDbContext db, string? userId) => new(db, User(userId));

        private async Task<(QuinielaSeed Seed, QuinielaJornada Jornada, QuinielaTicket Ticket)> SeedAsync(
            string suffix, string? ownerOverride = null, bool paid = false)
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches(suffix));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            var ticket = await SeedTicketAsync(fixture, jornada.Id, ownerOverride ?? seed.PlayerId, suffix,
                QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, paid: paid);
            return (seed, jornada, ticket);
        }

        [Fact]
        public async Task Handle_ByThePlayer_RemovesTheirPendingTicket()
        {
            var (seed, jornada, ticket) = await SeedAsync("m1");
            await using var db = fixture.CreateDbContext();

            await Handler(db, seed.PlayerId).Handle(new DeleteMyQuinielaTicket.Command(seed.TeamId, jornada.Id), CancellationToken.None);

            await using var verify = fixture.CreateDbContext();
            Assert.False(await verify.QuinielaTickets.AnyAsync(t => t.Id == ticket.Id));
        }

        [Fact]
        public async Task Handle_ByAFamilyMember_RemovesTheirPendingTicket()
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("m2"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            var ticket = await SeedTicketAsync(fixture, jornada.Id, seed.FamilyId, "m2", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away);
            await using var db = fixture.CreateDbContext();

            await Handler(db, seed.FamilyId).Handle(new DeleteMyQuinielaTicket.Command(seed.TeamId, jornada.Id), CancellationToken.None);

            await using var verify = fixture.CreateDbContext();
            Assert.False(await verify.QuinielaTickets.AnyAsync(t => t.Id == ticket.Id));
        }

        [Fact]
        public async Task Handle_OnAPaidTicket_IsRejectedAndKeepsTheTicket()
        {
            var (seed, jornada, ticket) = await SeedAsync("m3", paid: true);
            await using var db = fixture.CreateDbContext();

            var ex = await Assert.ThrowsAsync<DomainException>(() =>
                Handler(db, seed.PlayerId).Handle(new DeleteMyQuinielaTicket.Command(seed.TeamId, jornada.Id), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaTicketNotDeletable, ex.Code);
            await using var verify = fixture.CreateDbContext();
            Assert.True(await verify.QuinielaTickets.AnyAsync(t => t.Id == ticket.Id));
        }

        [Fact]
        public async Task Handle_WithoutATicket_ThrowsNotFound()
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("m4"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            await using var db = fixture.CreateDbContext();

            var ex = await Assert.ThrowsAsync<NotFoundException>(() =>
                Handler(db, seed.PlayerId).Handle(new DeleteMyQuinielaTicket.Command(seed.TeamId, jornada.Id), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaTicketNotFound, ex.Code);
        }

        [Fact]
        public async Task Handle_DoesNotTouchTheTicketOfAnotherUser()
        {
            var (seed, jornada, ticket) = await SeedAsync("m5");
            await using var db = fixture.CreateDbContext();

            await Assert.ThrowsAsync<NotFoundException>(() =>
                Handler(db, seed.FamilyId).Handle(new DeleteMyQuinielaTicket.Command(seed.TeamId, jornada.Id), CancellationToken.None).AsTask());

            await using var verify = fixture.CreateDbContext();
            Assert.True(await verify.QuinielaTickets.AnyAsync(t => t.Id == ticket.Id));
        }

        [Fact]
        public async Task Handle_ByAFollower_ThrowsForbidden()
        {
            var (seed, jornada, _) = await SeedAsync("m6");
            await using var db = fixture.CreateDbContext();

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                Handler(db, seed.FollowerId).Handle(new DeleteMyQuinielaTicket.Command(seed.TeamId, jornada.Id), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Handle_OnASettledJornada_IsRejected()
        {
            var (seed, jornada, ticket) = await SeedAsync("m7");
            await using (var setup = fixture.CreateDbContext())
            {
                (await setup.QuinielaJornadas.SingleAsync(j => j.Id == jornada.Id)).Settle(0m, AfterMatches);
                await setup.SaveChangesAsync();
            }
            await using var db = fixture.CreateDbContext();

            var ex = await Assert.ThrowsAsync<DomainException>(() =>
                Handler(db, seed.PlayerId).Handle(new DeleteMyQuinielaTicket.Command(seed.TeamId, jornada.Id), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaAlreadySettled, ex.Code);
            await using var verify = fixture.CreateDbContext();
            Assert.True(await verify.QuinielaTickets.AnyAsync(t => t.Id == ticket.Id));
        }
    }
}
