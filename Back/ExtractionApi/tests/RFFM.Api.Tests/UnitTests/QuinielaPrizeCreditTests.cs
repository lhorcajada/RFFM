#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Features.Coaches.Quiniela;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.UnitTests.QuinielaTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class QuinielaPrizeCreditTests(PostgresContainerFixture fixture)
    {
        // Resultados: A 1-0 (1), B 1-1 (X), C 0-1 (2, Pleno 0-1). El boleto del jugador acierta todo y el Pleno (Especial, 0,85 €).
        private async Task<(QuinielaSeed Seed, QuinielaJornada Jornada, QuinielaTicket Winner)> SeedAsync(string suffix)
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches(suffix, "1-0", "1-1", "0-1"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            var winner = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, suffix, QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, 0, 1, paid: true);
            await SeedTicketAsync(fixture, jornada.Id, seed.CoachId, suffix, QuinielaSign.Away, QuinielaSign.Home, QuinielaSign.Home, paid: true);
            for (var i = 0; i < 6; i++)
                await SeedTicketAsync(fixture, jornada.Id, $"extra-{Guid.NewGuid():N}", suffix, QuinielaSign.Away, QuinielaSign.Home, QuinielaSign.Home, paid: true);
            return (seed, jornada, winner);
        }

        private async Task SettleAsync(QuinielaSeed seed, QuinielaJornada jornada)
        {
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();
            await new SettleQuiniela.Handler(db, fed, User(seed.CoachId), ClockAt(AfterMatches))
                .Handle(new SettleQuiniela.Command(seed.TeamId, jornada.Id), CancellationToken.None);
        }

        private async Task<QuinielaPrizeCreditDto> CreditAsync(QuinielaSeed seed, string? userId = null)
        {
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();
            return await new CreditQuinielaPrizes.Handler(db, fed, User(userId ?? seed.CoachId), ClockAt(AfterMatches))
                .Handle(new CreditQuinielaPrizes.Command(seed.TeamId), CancellationToken.None);
        }

        private async Task ForgetPrizeCreditsAsync(string teamId)
        {
            await using var db = fixture.CreateDbContext();
            await db.QuinielaWallets.Where(w => w.TeamId == teamId).ExecuteDeleteAsync();
        }

        [Fact]
        public async Task Settle_CreditsTheWinnersPrizeToTheirWallet_CreatingItWhenMissing()
        {
            var (seed, jornada, winner) = await SeedAsync("p1");

            await SettleAsync(seed, jornada);

            await using var verify = fixture.CreateDbContext();
            var wallet = await verify.QuinielaWallets.SingleAsync(w => w.TeamId == seed.TeamId && w.ApplicationUserId == seed.PlayerId);
            Assert.Equal(0.85m, wallet.Balance);
            var movement = await verify.QuinielaWalletMovements.SingleAsync(m => m.WalletId == wallet.Id);
            Assert.Equal((QuinielaWalletMovementType.Prize, 0.85m, winner.Id), (movement.Type, movement.Amount, movement.TicketId));
        }

        [Fact]
        public async Task Settle_DoesNotCreateWalletsForTicketsWithoutPrize()
        {
            var (seed, jornada, _) = await SeedAsync("p2");

            await SettleAsync(seed, jornada);

            await using var verify = fixture.CreateDbContext();
            Assert.False(await verify.QuinielaWallets.AnyAsync(w => w.TeamId == seed.TeamId && w.ApplicationUserId == seed.CoachId));
        }

        [Fact]
        public async Task Settle_AddsThePrizeToTheBalanceTheWalletAlreadyHad()
        {
            var (seed, jornada, _) = await SeedAsync("p3");
            await using (var db = fixture.CreateDbContext())
            {
                var wallet = QuinielaWallet.Create(seed.TeamId, seed.PlayerId);
                db.QuinielaWalletMovements.Add(wallet.TopUp(2m, seed.CoachId, "Bizum", AfterMatches));
                db.QuinielaWallets.Add(wallet);
                await db.SaveChangesAsync();
            }

            await SettleAsync(seed, jornada);

            await using var verify = fixture.CreateDbContext();
            Assert.Equal(2.85m, (await verify.QuinielaWallets.SingleAsync(w => w.ApplicationUserId == seed.PlayerId && w.TeamId == seed.TeamId)).Balance);
        }

        [Fact]
        public async Task Credit_PaysPrizesOfAlreadySettledJornadas_OnlyOnce()
        {
            var (seed, jornada, _) = await SeedAsync("p4");
            await SettleAsync(seed, jornada);
            await ForgetPrizeCreditsAsync(seed.TeamId);

            var first = await CreditAsync(seed);
            var second = await CreditAsync(seed);

            Assert.Equal((1, 0.85m), (first.Tickets, first.Total));
            Assert.Equal((0, 0m), (second.Tickets, second.Total));
            await using var verify = fixture.CreateDbContext();
            Assert.Equal(0.85m, (await verify.QuinielaWallets.SingleAsync(w => w.TeamId == seed.TeamId && w.ApplicationUserId == seed.PlayerId)).Balance);
        }

        [Fact]
        public async Task Credit_SkipsPrizesAlreadyCreditedAtSettlement()
        {
            var (seed, jornada, _) = await SeedAsync("p5");
            await SettleAsync(seed, jornada);

            var result = await CreditAsync(seed);

            Assert.Equal((0, 0m), (result.Tickets, result.Total));
        }

        [Fact]
        public async Task Credit_IsForbiddenForNonCoaches()
        {
            var (seed, _, _) = await SeedAsync("p6");

            await Assert.ThrowsAsync<RFFM.Api.Domain.ForbiddenAccessException>(() => CreditAsync(seed, seed.PlayerId));
        }
    }
}
