#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Features.Coaches.Quiniela;
using RFFM.Api.Tests.Fixtures;
using RFFM.Api.Tests.UnitTests;
using Xunit;
using static RFFM.Api.Tests.UnitTests.QuinielaTestSupport;
using Wallets = RFFM.Api.Tests.UnitTests.QuinielaWalletTestSupport;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Dos operaciones simultáneas sobre el mismo monedero no gastan el saldo dos veces (xmin + reintento).
    /// Requiere PostgreSQL real. See openspec/changes/quiniela-wallet/design.md → D3.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class QuinielaWalletConcurrencyTests(PostgresContainerFixture fixture)
    {
        [Fact]
        public async Task TwoSimultaneousSaves_WithBalanceForOne_PayExactlyOneTicket()
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("k1"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            await Wallets.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 1m);

            async Task<QuinielaTicketDto> SaveOne()
            {
                await using var db = fixture.CreateDbContext();
                await using var fed = fixture.CreateFederationDbContext();
                var handler = new SaveQuinielaTicket.Handler(db, fed, User(seed.PlayerId), ClockAt(BeforeKickoff), new FakeFeatureFlags(true));
                return await handler.Handle(new SaveQuinielaTicket.Command
                {
                    TeamId = seed.TeamId,
                    JornadaId = jornada.Id,
                    Picks = [new("Ak1", "1"), new("Bk1", "X"), new("Ck1", "2")],
                    PlenoHome = 0,
                    PlenoAway = 1
                }, CancellationToken.None);
            }

            var results = await Task.WhenAll(SaveOne(), SaveOne());

            Assert.Equal(1, results.Count(r => r.PaymentStatus == "Paid"));
            Assert.Equal(1, results.Count(r => r.PaymentStatus == "Pending"));
            Assert.Equal(0m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
            var movements = await Wallets.MovementsOfAsync(fixture, seed.TeamId, seed.PlayerId);
            Assert.Single(movements.Where(m => m.Type == QuinielaWalletMovementType.TicketCharge));
        }

        [Fact]
        public async Task TwoSimultaneousTopUps_OnAMissingWallet_CreateOneWalletWithTheSum()
        {
            var seed = await SeedTeamAsync(fixture);

            async Task TopUpOne()
            {
                await using var db = fixture.CreateDbContext();
                await new TopUpQuinielaWallet.Handler(db, User(seed.CoachId), ClockAt(BeforeKickoff))
                    .Handle(new TopUpQuinielaWallet.Command(seed.TeamId, seed.PlayerId, 2m, null), CancellationToken.None);
            }

            await Task.WhenAll(TopUpOne(), TopUpOne());

            await using var verify = fixture.CreateDbContext();
            Assert.Equal(1, await verify.QuinielaWallets.CountAsync(w => w.TeamId == seed.TeamId && w.ApplicationUserId == seed.PlayerId));
            Assert.Equal(4m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
            Assert.Equal(2, (await Wallets.MovementsOfAsync(fixture, seed.TeamId, seed.PlayerId)).Count);
        }

        [Fact]
        public async Task TwoSimultaneousExplicitPayments_OfTheSameTicket_ChargeOnce()
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("k3"));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            var ticket = await SeedTicketAsync(fixture, jornada.Id, seed.PlayerId, "k3", QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away);
            await Wallets.SeedWalletAsync(fixture, seed.TeamId, seed.PlayerId, 5m);

            async Task<bool> PayOne()
            {
                await using var db = fixture.CreateDbContext();
                await using var fed = fixture.CreateFederationDbContext();
                try
                {
                    await new PayQuinielaTicketWithWallet.Handler(db, fed, User(seed.PlayerId), ClockAt(BeforeKickoff))
                        .Handle(new PayQuinielaTicketWithWallet.Command(seed.TeamId, jornada.Id, ticket.Id), CancellationToken.None);
                    return true;
                }
                catch (ConflictException)
                {
                    return false;
                }
            }

            var outcomes = await Task.WhenAll(PayOne(), PayOne());

            Assert.Equal(1, outcomes.Count(o => o));
            Assert.Equal(4m, await Wallets.BalanceOfAsync(fixture, seed.TeamId, seed.PlayerId));
        }
    }
}
