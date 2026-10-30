#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Features.Coaches.Quiniela;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.UnitTests.QuinielaTestSupport;
using Wallets = RFFM.Api.Tests.UnitTests.QuinielaWalletTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Cobro del monedero al guardar, pago explícito, borrados y reembolsos.
    /// See openspec/changes/quiniela-wallet/design.md → D2, D2b, D2c, D5, D5b.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class QuinielaWalletTicketTests(PostgresContainerFixture fixture)
    {
        // Sábado 2026-11-07 10:00 UTC: plazo de pago (viernes 23:59) vencido, pero los pronósticos siguen abiertos.
        private static readonly DateTime ExpiredButOpen = new(2026, 11, 7, 10, 0, 0, DateTimeKind.Utc);

        private static SaveQuinielaTicket.Handler Save(AppDbContext db, FederationDbContext fed, string? userId, DateTime? now = null) =>
            new(db, fed, User(userId), ClockAt(now ?? BeforeKickoff), new FakeFeatureFlags(true));

        private static PayQuinielaTicketWithWallet.Handler Pay(AppDbContext db, FederationDbContext fed, string? userId, DateTime? now = null) =>
            new(db, fed, User(userId), ClockAt(now ?? BeforeKickoff));

        private static DeleteMyQuinielaTicket.Handler DeleteMine(AppDbContext db, FederationDbContext fed, string? userId, DateTime? now = null) =>
            new(db, fed, User(userId), ClockAt(now ?? BeforeKickoff));

        private static SaveQuinielaTicket.Command SaveCommand(string teamId, string jornadaId, string suffix, string? ticketId = null) => new()
        {
            TeamId = teamId,
            JornadaId = jornadaId,
            TicketId = ticketId,
            Picks = [new($"A{suffix}", "1"), new($"B{suffix}", "X"), new($"C{suffix}", "2")],
            PlenoHome = 0,
            PlenoAway = 1
        };

        private async Task<(QuinielaSeed Seed, QuinielaJornada Jornada)> OpenAsync(string suffix)
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches(suffix));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            return (seed, jornada);
        }

        private async Task<QuinielaTicketDto> SaveAsync(QuinielaSeed seed, QuinielaJornada jornada, string suffix, string? ticketId = null, DateTime? now = null)
        {
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();
            return await Save(db, fed, seed.PlayerId, now).Handle(SaveCommand(seed.TeamId, jornada.Id, suffix, ticketId), CancellationToken.None);
        }

        private async Task<QuinielaTicket> PaidWithWalletAsync(QuinielaSeed seed, QuinielaJornada jornada, string suffix, decimal balance = 1m)
        {
            await Wallets.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, balance);
            var dto = await SaveAsync(seed, jornada, suffix);
            await using var db = fixture.CreateDbContext();
            var ticket = await db.QuinielaTickets.SingleAsync(t => t.Id == dto.Id);
            Assert.True(ticket.PaidFromWallet);
            return ticket;
        }

        // ================= Guardar: cobro todo-o-nada =================

        [Fact]
        public async Task Save_NewTicketWithEnoughBalance_ChargesAndMarksPaidWithWallet()
        {
            var (seed, jornada) = await OpenAsync("w1");
            await Wallets.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 3m);

            var dto = await SaveAsync(seed, jornada, "w1");

            Assert.Equal("Paid", dto.PaymentStatus);
            Assert.Equal("Wallet", dto.PaymentMethod);
            Assert.NotNull(dto.WalletCharge);
            Assert.Equal(1m, dto.WalletCharge!.Amount);
            Assert.Equal(2m, dto.WalletCharge.BalanceAfter);
            Assert.Equal(2m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
            var charge = (await Wallets.MovementsOfAsync(fixture, seed.TeamId, seed.PlayerId)).Single(m => m.Type == QuinielaWalletMovementType.TicketCharge);
            Assert.Equal(dto.Id, charge.TicketId);
            Assert.Equal(-1m, charge.Amount);
        }

        [Fact]
        public async Task Save_WithExactlyThePriceInTheWallet_LeavesZero()
        {
            var (seed, jornada) = await OpenAsync("w2");
            await Wallets.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 1m);

            var dto = await SaveAsync(seed, jornada, "w2");

            Assert.Equal("Paid", dto.PaymentStatus);
            Assert.Equal(0m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
        }

        [Fact]
        public async Task Save_WithInsufficientBalance_StaysPendingAndKeepsTheBalance()
        {
            var (seed, jornada) = await OpenAsync("w3");
            await Wallets.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 0.5m);

            var dto = await SaveAsync(seed, jornada, "w3");

            Assert.Equal("Pending", dto.PaymentStatus);
            Assert.Null(dto.PaymentMethod);
            Assert.Null(dto.WalletCharge);
            Assert.Equal(0.5m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
            Assert.Single(await Wallets.MovementsOfAsync(fixture, seed.TeamId, seed.PlayerId));
        }

        [Fact]
        public async Task Save_WithoutAWallet_StaysPendingAndDoesNotCreateOne()
        {
            var (seed, jornada) = await OpenAsync("w4");

            var dto = await SaveAsync(seed, jornada, "w4");

            Assert.Equal("Pending", dto.PaymentStatus);
            Assert.Null(dto.WalletCharge);
            await using var db = fixture.CreateDbContext();
            Assert.False(await db.QuinielaWallets.AnyAsync(w => w.TeamId == seed.TeamId));
        }

        [Fact]
        public async Task Save_WhenTheSaveIsRejected_DoesNotChargeAnything()
        {
            var (seed, jornada) = await OpenAsync("w5");
            await Wallets.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 3m);

            await Assert.ThrowsAsync<DomainException>(() => SaveAsync(seed, jornada, "w5", now: AfterMatches));

            Assert.Equal(3m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
            Assert.Single(await Wallets.MovementsOfAsync(fixture, seed.TeamId, seed.PlayerId));
        }

        [Fact]
        public async Task Save_EditingAPendingTicketAfterATopUp_ChargesOnce()
        {
            var (seed, jornada) = await OpenAsync("w6");
            var created = await SaveAsync(seed, jornada, "w6");
            Assert.Equal("Pending", created.PaymentStatus);
            await Wallets.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 3m);

            var edited = await SaveAsync(seed, jornada, "w6", created.Id);
            var again = await SaveAsync(seed, jornada, "w6", created.Id);

            Assert.Equal("Paid", edited.PaymentStatus);
            Assert.Equal("Wallet", edited.PaymentMethod);
            Assert.Equal(1m, edited.WalletCharge!.Amount);
            Assert.Null(again.WalletCharge);
            Assert.Equal(2m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
            Assert.Single((await Wallets.MovementsOfAsync(fixture, seed.TeamId, seed.PlayerId)).Where(m => m.Type == QuinielaWalletMovementType.TicketCharge));
        }

        [Fact]
        public async Task Save_EditingAnAlreadyPaidTicket_DoesNotChargeAgain()
        {
            var (seed, jornada) = await OpenAsync("w7");
            await Wallets.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 5m);
            var created = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "w7", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, paid: true);

            var edited = await SaveAsync(seed, jornada, "w7", created.Id);

            Assert.Equal("Paid", edited.PaymentStatus);
            Assert.Null(edited.WalletCharge);
            Assert.Equal(5m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
        }

        [Fact]
        public async Task Save_EditingAnExpiredTicket_DoesNotCharge()
        {
            var (seed, jornada) = await OpenAsync("w8");
            var created = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "w8", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away);
            await Wallets.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 5m);

            var edited = await SaveAsync(seed, jornada, "w8", created.Id, ExpiredButOpen);

            Assert.Equal("Expired", edited.PaymentStatus);
            Assert.Null(edited.WalletCharge);
            Assert.Equal(5m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
        }

        // ================= Pago explícito con monedero =================

        [Fact]
        public async Task Pay_PendingTicketWithEnoughBalance_PaysAndRecordsTheCharge()
        {
            var (seed, jornada) = await OpenAsync("p1");
            var ticket = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "p1", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away);
            await Wallets.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 2m);
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var dto = await Pay(db, fed, seed.PlayerId).Handle(new PayQuinielaTicketWithWallet.Command(seed.TeamId, jornada.Id, ticket.Id), CancellationToken.None);

            Assert.Equal("Paid", dto.PaymentStatus);
            Assert.Equal("Wallet", dto.PaymentMethod);
            Assert.Equal(1m, dto.WalletCharge!.Amount);
            Assert.Equal(1m, dto.WalletCharge.BalanceAfter);
            Assert.Equal(1m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
        }

        [Fact]
        public async Task Pay_WithInsufficientBalance_ThrowsConflictAndKeepsTheTicketPending()
        {
            var (seed, jornada) = await OpenAsync("p2");
            var ticket = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "p2", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away);
            await Wallets.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 0.5m);
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var ex = await Assert.ThrowsAsync<ConflictException>(() =>
                Pay(db, fed, seed.PlayerId).Handle(new PayQuinielaTicketWithWallet.Command(seed.TeamId, jornada.Id, ticket.Id), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaWalletInsufficientBalance, ex.Code);
            await using var verify = fixture.CreateDbContext();
            Assert.Equal(QuinielaPaymentStatus.Pending, (await verify.QuinielaTickets.SingleAsync(t => t.Id == ticket.Id)).PaymentStatus);
            Assert.Equal(0.5m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
        }

        [Fact]
        public async Task Pay_WithoutAWallet_ThrowsConflict()
        {
            var (seed, jornada) = await OpenAsync("p3");
            var ticket = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "p3", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away);
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var ex = await Assert.ThrowsAsync<ConflictException>(() =>
                Pay(db, fed, seed.PlayerId).Handle(new PayQuinielaTicketWithWallet.Command(seed.TeamId, jornada.Id, ticket.Id), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaWalletInsufficientBalance, ex.Code);
        }

        [Fact]
        public async Task Pay_AnAlreadyPaidTicket_ThrowsNotPayableAndDoesNotCharge()
        {
            var (seed, jornada) = await OpenAsync("p4");
            var ticket = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "p4", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, paid: true);
            await Wallets.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 5m);
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var ex = await Assert.ThrowsAsync<ConflictException>(() =>
                Pay(db, fed, seed.PlayerId).Handle(new PayQuinielaTicketWithWallet.Command(seed.TeamId, jornada.Id, ticket.Id), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaTicketNotPayable, ex.Code);
            Assert.Equal(5m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
        }

        [Fact]
        public async Task Pay_AnExpiredTicket_ThrowsNotPayable()
        {
            var (seed, jornada) = await OpenAsync("p5");
            var ticket = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "p5", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away);
            await Wallets.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 5m);
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var ex = await Assert.ThrowsAsync<ConflictException>(() =>
                Pay(db, fed, seed.PlayerId, ExpiredButOpen).Handle(new PayQuinielaTicketWithWallet.Command(seed.TeamId, jornada.Id, ticket.Id), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaTicketNotPayable, ex.Code);
            Assert.Equal(5m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
        }

        [Fact]
        public async Task Pay_WithPicksClosed_ThrowsPicksClosed()
        {
            var (seed, jornada) = await OpenAsync("p6");
            var ticket = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "p6", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away);
            await Wallets.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 5m);
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var ex = await Assert.ThrowsAsync<DomainException>(() =>
                Pay(db, fed, seed.PlayerId, AfterMatches).Handle(new PayQuinielaTicketWithWallet.Command(seed.TeamId, jornada.Id, ticket.Id), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaPicksClosed, ex.Code);
            Assert.Equal(5m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
        }

        [Fact]
        public async Task Pay_SomeoneElsesTicket_ThrowsNotFound()
        {
            var (seed, jornada) = await OpenAsync("p7");
            var ticket = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "p7", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away);
            await Wallets.SeedWalletAsync(fixture, seed.TeamId, seed.FamilyId, 5m);
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            await Assert.ThrowsAsync<NotFoundException>(() =>
                Pay(db, fed, seed.FamilyId).Handle(new PayQuinielaTicketWithWallet.Command(seed.TeamId, jornada.Id, ticket.Id), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Pay_ByAFollower_ThrowsForbidden()
        {
            var (seed, jornada) = await OpenAsync("p8");
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                Pay(db, fed, seed.FollowerId).Handle(new PayQuinielaTicketWithWallet.Command(seed.TeamId, jornada.Id, "any"), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Pay_TwiceInARow_ChargesOnlyOnce()
        {
            var (seed, jornada) = await OpenAsync("p9");
            var ticket = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "p9", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away);
            await Wallets.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 5m);
            var command = new PayQuinielaTicketWithWallet.Command(seed.TeamId, jornada.Id, ticket.Id);

            await using (var db = fixture.CreateDbContext())
            await using (var fed = fixture.CreateFederationDbContext())
                await Pay(db, fed, seed.PlayerId).Handle(command, CancellationToken.None);
            await using var db2 = fixture.CreateDbContext();
            await using var fed2 = fixture.CreateFederationDbContext();
            await Assert.ThrowsAsync<ConflictException>(() => Pay(db2, fed2, seed.PlayerId).Handle(command, CancellationToken.None).AsTask());

            Assert.Equal(4m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
        }

        [Fact]
        public void PayValidator_RequiresTheIds()
        {
            var validator = new PayQuinielaTicketWithWallet.Validator();

            Assert.False(validator.Validate(new PayQuinielaTicketWithWallet.Command("", "j", "t")).IsValid);
            Assert.True(validator.Validate(new PayQuinielaTicketWithWallet.Command("a", "j", "t")).IsValid);
        }

        // ================= Borrado propio =================

        [Fact]
        public async Task DeleteMine_WalletPaidTicket_RefundsOnce()
        {
            var (seed, jornada) = await OpenAsync("d1");
            var ticket = await PaidWithWalletAsync(seed, jornada, "d1");
            Assert.Equal(0m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            await DeleteMine(db, fed, seed.PlayerId).Handle(new DeleteMyQuinielaTicket.Command(seed.TeamId, jornada.Id, ticket.Id), CancellationToken.None);

            Assert.Equal(1m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
            var refunds = (await Wallets.MovementsOfAsync(fixture, seed.TeamId, seed.PlayerId)).Where(m => m.Type == QuinielaWalletMovementType.TicketRefund).ToList();
            Assert.Single(refunds);
            Assert.Equal(1m, refunds[0].Amount);
            await using var verify = fixture.CreateDbContext();
            Assert.False(await verify.QuinielaTickets.AnyAsync(t => t.Id == ticket.Id));
        }

        [Fact]
        public async Task DeleteMine_DeletingTwice_RefundsOnlyOnce()
        {
            var (seed, jornada) = await OpenAsync("d2");
            var ticket = await PaidWithWalletAsync(seed, jornada, "d2");
            var command = new DeleteMyQuinielaTicket.Command(seed.TeamId, jornada.Id, ticket.Id);
            await using (var db = fixture.CreateDbContext())
            await using (var fed = fixture.CreateFederationDbContext())
                await DeleteMine(db, fed, seed.PlayerId).Handle(command, CancellationToken.None);
            await using var db2 = fixture.CreateDbContext();
            await using var fed2 = fixture.CreateFederationDbContext();

            await Assert.ThrowsAsync<NotFoundException>(() => DeleteMine(db2, fed2, seed.PlayerId).Handle(command, CancellationToken.None).AsTask());

            Assert.Equal(1m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
        }

        [Theory]
        [InlineData("Cash")]
        [InlineData("Bizum")]
        public async Task DeleteMine_ManuallyPaidTicket_ThrowsConflictAndKeepsEverything(string method)
        {
            var (seed, jornada) = await OpenAsync($"d3{method}");
            var ticket = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, $"d3{method}", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away);
            await using (var setup = fixture.CreateDbContext())
            {
                (await setup.QuinielaTickets.SingleAsync(t => t.Id == ticket.Id)).MarkPaid(QuinielaPaymentMethod.FromName(method), BeforeKickoff);
                await setup.SaveChangesAsync();
            }
            await Wallets.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 2m);
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var ex = await Assert.ThrowsAsync<ConflictException>(() =>
                DeleteMine(db, fed, seed.PlayerId).Handle(new DeleteMyQuinielaTicket.Command(seed.TeamId, jornada.Id, ticket.Id), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaTicketPaidManually, ex.Code);
            await using var verify = fixture.CreateDbContext();
            Assert.True(await verify.QuinielaTickets.AnyAsync(t => t.Id == ticket.Id));
            Assert.Equal(2m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
        }

        [Fact]
        public async Task DeleteMine_ExpiredTicket_IsDeletedWithoutTouchingTheWallet()
        {
            var (seed, jornada) = await OpenAsync("d4");
            var ticket = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "d4", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away);
            await Wallets.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 2m);
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            await DeleteMine(db, fed, seed.PlayerId, ExpiredButOpen).Handle(new DeleteMyQuinielaTicket.Command(seed.TeamId, jornada.Id, ticket.Id), CancellationToken.None);

            await using var verify = fixture.CreateDbContext();
            Assert.False(await verify.QuinielaTickets.AnyAsync(t => t.Id == ticket.Id));
            Assert.Equal(2m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
        }

        [Fact]
        public async Task DeleteMine_WithPicksClosed_ThrowsPicksClosedAndDoesNotRefund()
        {
            var (seed, jornada) = await OpenAsync("d5");
            var ticket = await PaidWithWalletAsync(seed, jornada, "d5");
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var ex = await Assert.ThrowsAsync<DomainException>(() =>
                DeleteMine(db, fed, seed.PlayerId, AfterMatches).Handle(new DeleteMyQuinielaTicket.Command(seed.TeamId, jornada.Id, ticket.Id), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaPicksClosed, ex.Code);
            Assert.Equal(0m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
            await using var verify = fixture.CreateDbContext();
            Assert.True(await verify.QuinielaTickets.AnyAsync(t => t.Id == ticket.Id));
        }

        // ================= Borrado del entrenador, reinicio y cambio de pago =================

        [Fact]
        public async Task DeleteByCoach_WalletPaidTicket_RefundsTheOwner()
        {
            var (seed, jornada) = await OpenAsync("c1");
            var ticket = await PaidWithWalletAsync(seed, jornada, "c1");
            await using var db = fixture.CreateDbContext();

            await new DeleteQuinielaTicket.Handler(db, User(seed.CoachId))
                .Handle(new DeleteQuinielaTicket.Command(seed.TeamId, jornada.Id, ticket.Id), CancellationToken.None);

            Assert.Equal(1m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
            Assert.Single((await Wallets.MovementsOfAsync(fixture, seed.TeamId, seed.PlayerId)).Where(m => m.Type == QuinielaWalletMovementType.TicketRefund));
        }

        [Fact]
        public async Task DeleteByCoach_CashTicket_DoesNotTouchTheWallet()
        {
            var (seed, jornada) = await OpenAsync("c2");
            var ticket = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "c2", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, paid: true);
            await Wallets.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 2m);
            await using var db = fixture.CreateDbContext();

            await new DeleteQuinielaTicket.Handler(db, User(seed.CoachId))
                .Handle(new DeleteQuinielaTicket.Command(seed.TeamId, jornada.Id, ticket.Id), CancellationToken.None);

            Assert.Equal(2m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
        }

        [Fact]
        public async Task DeleteByCoach_OnASettledJornada_IsRejectedWithoutRefund()
        {
            var (seed, jornada) = await OpenAsync("c3");
            var ticket = await PaidWithWalletAsync(seed, jornada, "c3");
            await using (var setup = fixture.CreateDbContext())
            {
                (await setup.QuinielaJornadas.SingleAsync(j => j.Id == jornada.Id)).Settle(0m, AfterMatches);
                await setup.SaveChangesAsync();
            }
            await using var db = fixture.CreateDbContext();

            await Assert.ThrowsAsync<DomainException>(() =>
                new DeleteQuinielaTicket.Handler(db, User(seed.CoachId))
                    .Handle(new DeleteQuinielaTicket.Command(seed.TeamId, jornada.Id, ticket.Id), CancellationToken.None).AsTask());

            Assert.Equal(0m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
        }

        [Fact]
        public async Task Reset_RefundsEveryWalletPaidTicket()
        {
            var (seed, jornada) = await OpenAsync("c4");
            await PaidWithWalletAsync(seed, jornada, "c4");
            await Wallets.SeedWalletAsync(fixture, seed.TeamId, seed.FamilyId, 1m);
            await using (var db0 = fixture.CreateDbContext())
            await using (var fed0 = fixture.CreateFederationDbContext())
                await Save(db0, fed0, seed.FamilyId).Handle(SaveCommand(seed.TeamId, jornada.Id, "c4"), CancellationToken.None);
            await using var db = fixture.CreateDbContext();

            await new ResetQuiniela.Handler(db, User(seed.CoachId)).Handle(new ResetQuiniela.Command(seed.TeamId, jornada.Id), CancellationToken.None);

            Assert.Equal(1m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
            Assert.Equal(1m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.FamilyId));
        }

        [Theory]
        [InlineData(false, null)]
        [InlineData(true, "Cash")]
        public async Task SetPayment_WalletPaidTicketToPendingOrOtherMethod_RefundsTheWallet(bool paid, string? method)
        {
            var (seed, jornada) = await OpenAsync($"c5{paid}");
            var ticket = await PaidWithWalletAsync(seed, jornada, $"c5{paid}");
            await using var db = fixture.CreateDbContext();

            await new SetQuinielaTicketPayment.Handler(db, User(seed.CoachId), ClockAt(BeforeKickoff))
                .Handle(new SetQuinielaTicketPayment.Command { TeamId = seed.TeamId, JornadaId = jornada.Id, TicketId = ticket.Id, Paid = paid, Method = method }, CancellationToken.None);

            Assert.Equal(1m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
        }

        [Fact]
        public async Task SetPayment_WalletAsManualMethod_FailsValidation()
        {
            var result = new SetQuinielaTicketPayment.Validator().Validate(
                new SetQuinielaTicketPayment.Command { TeamId = "t", JornadaId = "j", TicketId = "x", Paid = true, Method = "Wallet" });

            Assert.False(result.IsValid);
        }
    }
}
