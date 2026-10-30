using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Teams;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>Dominio del monedero de la quiniela. See openspec/changes/quiniela-wallet/design.md → D1.</summary>
    public class QuinielaWalletTests
    {
        private static readonly DateTime Now = new(2026, 11, 4, 10, 0, 0, DateTimeKind.Utc);

        private static QuinielaWallet NewWallet(decimal balance = 0m)
        {
            var wallet = QuinielaWallet.Create("team1", "user1");
            if (balance > 0m)
                wallet.TopUp(balance, "coach1", null, Now);
            return wallet;
        }

        [Fact]
        public void Create_StartsWithZeroBalance()
        {
            var wallet = QuinielaWallet.Create("team1", "user1");

            Assert.Equal(0m, wallet.Balance);
            Assert.Equal("team1", wallet.TeamId);
            Assert.Equal("user1", wallet.ApplicationUserId);
        }

        [Fact]
        public void TopUp_AddsToTheBalanceAndReturnsAPositiveMovement()
        {
            var wallet = NewWallet(2m);

            var movement = wallet.TopUp(5m, "coach1", "Bizum", Now);

            Assert.Equal(7m, wallet.Balance);
            Assert.Equal(5m, movement.Amount);
            Assert.Equal(QuinielaWalletMovementType.TopUp, movement.Type);
            Assert.Equal(wallet.Id, movement.WalletId);
            Assert.Equal("coach1", movement.CreatedByUserId);
            Assert.Equal("Bizum", movement.Description);
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-1)]
        public void TopUp_WithZeroOrNegativeAmount_Fails(int amount)
        {
            var wallet = NewWallet(2m);

            var ex = Assert.Throws<DomainException>(() => wallet.TopUp(amount, "coach1", null, Now));

            Assert.Equal(ErrorCodes.QuinielaWalletInvalidAmount, ex.Code);
            Assert.Equal(2m, wallet.Balance);
        }

        [Fact]
        public void TopUp_WithMoreThanTwoDecimals_Fails()
        {
            var wallet = NewWallet();

            var ex = Assert.Throws<DomainException>(() => wallet.TopUp(1.005m, "coach1", null, Now));

            Assert.Equal(ErrorCodes.QuinielaWalletInvalidAmount, ex.Code);
        }

        [Fact]
        public void TopUp_AcceptsTheMaximumAndRejectsAboveIt()
        {
            var wallet = NewWallet();

            wallet.TopUp(QuinielaWallet.Rules.MaxMovementAmount, "coach1", null, Now);
            var ex = Assert.Throws<DomainException>(() => wallet.TopUp(10.01m, "coach1", null, Now));

            Assert.Equal(10m, QuinielaWallet.Rules.MaxMovementAmount);
            Assert.Equal(ErrorCodes.QuinielaWalletInvalidAmount, ex.Code);
            Assert.Equal(10m, wallet.Balance);
        }

        [Fact]
        public void Adjust_WithinTheBalance_SubtractsAndRecordsANegativeMovement()
        {
            var wallet = NewWallet(5m);

            var movement = wallet.Adjust(3m, "coach1", "Error de recarga", Now);

            Assert.Equal(2m, wallet.Balance);
            Assert.Equal(-3m, movement.Amount);
            Assert.Equal(QuinielaWalletMovementType.Adjustment, movement.Type);
            Assert.Equal("Error de recarga", movement.Description);
        }

        [Fact]
        public void Adjust_AboveTheBalance_FailsWithConflictAndKeepsTheBalance()
        {
            var wallet = NewWallet(5m);

            var ex = Assert.Throws<ConflictException>(() => wallet.Adjust(6m, "coach1", "motivo", Now));

            Assert.Equal(ErrorCodes.QuinielaWalletInsufficientBalance, ex.Code);
            Assert.Equal(5m, wallet.Balance);
        }

        [Fact]
        public void Adjust_WithoutReason_Fails()
        {
            var wallet = NewWallet(5m);

            var ex = Assert.Throws<DomainException>(() => wallet.Adjust(1m, "coach1", " ", Now));

            Assert.Equal(ErrorCodes.QuinielaWalletInvalidAmount, ex.Code);
        }

        [Theory]
        [InlineData("3.00", "1.00", "2.00")]
        [InlineData("1.00", "1.00", "0.00")]
        public void TryChargeTicket_WithEnoughBalance_SubtractsThePrice(string balance, string price, string expected)
        {
            var wallet = NewWallet(decimal.Parse(balance, System.Globalization.CultureInfo.InvariantCulture));

            var movement = wallet.TryChargeTicket("ticket1", decimal.Parse(price, System.Globalization.CultureInfo.InvariantCulture), Now);

            Assert.NotNull(movement);
            Assert.Equal(decimal.Parse(expected, System.Globalization.CultureInfo.InvariantCulture), wallet.Balance);
            Assert.Equal(-decimal.Parse(price, System.Globalization.CultureInfo.InvariantCulture), movement!.Amount);
            Assert.Equal(QuinielaWalletMovementType.TicketCharge, movement.Type);
            Assert.Equal("ticket1", movement.TicketId);
        }

        [Fact]
        public void TryChargeTicket_WithInsufficientBalance_ReturnsNullAndChangesNothing()
        {
            var wallet = NewWallet(0.5m);

            var movement = wallet.TryChargeTicket("ticket1", 1m, Now);

            Assert.Null(movement);
            Assert.Equal(0.5m, wallet.Balance);
        }

        [Fact]
        public void RefundTicket_AddsTheAmountBackAndLinksTheTicket()
        {
            var wallet = NewWallet(1m);
            wallet.TryChargeTicket("ticket1", 1m, Now);

            var movement = wallet.RefundTicket("ticket1", 1m, Now);

            Assert.Equal(1m, wallet.Balance);
            Assert.Equal(1m, movement.Amount);
            Assert.Equal(QuinielaWalletMovementType.TicketRefund, movement.Type);
            Assert.Equal("ticket1", movement.TicketId);
        }

        [Fact]
        public void Balance_AlwaysEqualsTheSumOfTheMovements()
        {
            var wallet = QuinielaWallet.Create("team1", "user1");
            var movements = new List<QuinielaWalletMovement>
            {
                wallet.TopUp(10m, "coach1", null, Now),
                wallet.TryChargeTicket("t1", 1m, Now)!,
                wallet.Adjust(2m, "coach1", "motivo", Now),
                wallet.RefundTicket("t1", 1m, Now)
            };

            Assert.Equal(movements.Sum(m => m.Amount), wallet.Balance);
        }

        [Fact]
        public void PaidFromWallet_IsTrueOnlyForPaidTicketsWithTheWalletMethod()
        {
            var ticket = QuinielaTicket.Create("j1", "u1", [new("A", QuinielaSign.Home)], 0, 1);
            Assert.False(ticket.PaidFromWallet);

            ticket.MarkPaid(QuinielaPaymentMethod.Cash, Now);
            Assert.False(ticket.PaidFromWallet);

            ticket.MarkPaid(QuinielaPaymentMethod.Wallet, Now);
            Assert.True(ticket.PaidFromWallet);

            ticket.MarkPending();
            Assert.False(ticket.PaidFromWallet);
        }
    }
}
