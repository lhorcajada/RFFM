#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Features.Coaches.Teams.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using RFFM.Api.Tests.UnitTests;
using Xunit;
using static RFFM.Api.Tests.UnitTests.QuinielaTestSupport;
using GetTeamTransactionsFeature = RFFM.Api.Features.Coaches.Teams.Queries.GetTeamTransactions;
using TeamTransactionDto = RFFM.Api.Features.Coaches.Teams.Queries.GetTeamTransactions.TeamTransactionDto;
using TeamTransactionsQuery = RFFM.Api.Features.Coaches.Teams.Queries.GetTeamTransactions.TeamTransactionsQuery;
using TransactionStatus = RFFM.Api.Features.Coaches.Teams.Queries.GetTeamTransactions.TransactionStatus;
using TransactionType = RFFM.Api.Features.Coaches.Teams.Queries.GetTeamTransactions.TransactionType;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Covers GET /api/catalog/team/{teamId}/transactions (<see cref="GetTeamTransactionsFeature.Handler"/>):
    /// access, the five transaction sources, the typed status per type, ordering and filters.
    /// Direct-handler tests on the real PostgreSQL fixture, following GetTeamFundHandlerTests and the
    /// QuinielaTestSupport helpers. See openspec/changes/team-transactions-window/specs/team-transactions-list/spec.md.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class GetTeamTransactionsHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetTeamTransactionsHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static DateTime Utc(int month, int day, int hour = 0) => new(2026, month, day, hour, 0, 0, DateTimeKind.Utc);

        private static string Suffix() => Guid.NewGuid().ToString("N")[..8];

        private async Task<IReadOnlyList<TeamTransactionDto>> HandleAsync(
            string teamId, string userId, TransactionStatus? status = null, TransactionType? type = null)
        {
            await using var db = _fixture.CreateDbContext();
            await using var fed = _fixture.CreateFederationDbContext();
            var handler = new GetTeamTransactionsFeature.Handler(db, fed, User(userId));
            return await handler.Handle(new TeamTransactionsQuery(teamId, status, type), CancellationToken.None);
        }

        private async Task<T> SaveAsync<T>(Func<AppDbContext, T> seed)
        {
            await using var db = _fixture.CreateDbContext();
            var result = seed(db);
            await db.SaveChangesAsync();
            return result;
        }

        private async Task<Guid> TeamPlayerAsync(QuinielaSeed seed, string name = "Ana", string lastName = "Lopez")
        {
            await using var db = _fixture.CreateDbContext();
            return await SeedTeamPlayerAsync(db, seed, name, lastName);
        }

        private static TeamPlayerSanction Sanction(Guid teamPlayerId, DateTime startDate, decimal? fine, decimal? amountPaid = null) =>
            TeamPlayerSanction.Create(teamPlayerId.ToString(), SanctionCategory.Competition, startDate, "Expulsión", null, null,
                fine: fine, amountPaid: amountPaid);

        private static LotteryCampaign Campaign(string teamId, decimal ticketPrice = 2m, int ticketsPerBook = 10) =>
            LotteryCampaign.Create(teamId, "Lotería", new DateOnly(2026, 12, 20), ticketPrice, ticketsPerBook,
                new DateOnly(2026, 10, 1), new DateOnly(2026, 12, 1));

        private async Task<QuinielaJornada> JornadaAsync(QuinielaSeed seed, string suffix)
        {
            var roundId = await SeedRoundAsync(_fixture, seed.GroupCode, 1, StandardMatches(suffix));
            return await SeedJornadaAsync(_fixture, seed.TeamId, roundId);
        }

        private static QuinielaTicket NewTicket(string jornadaId, string userId, string suffix) =>
            QuinielaTicket.Create(jornadaId, userId,
                [new($"A{suffix}", QuinielaSign.Home), new($"B{suffix}", QuinielaSign.Draw), new($"C{suffix}", QuinielaSign.Away)],
                0, 1);

        private async Task SeedWalletChargeAsync(QuinielaSeed seed, QuinielaJornada jornada, string suffix)
        {
            await SaveAsync(db =>
            {
                var wallet = QuinielaWallet.Create(seed.TeamId, seed.PlayerId);
                db.QuinielaWallets.Add(wallet);
                db.QuinielaWalletMovements.Add(wallet.TopUp(5m, seed.PlayerId, "Recarga", Utc(3, 2)));
                var ticket = NewTicket(jornada.Id, seed.PlayerId, suffix);
                db.QuinielaTickets.Add(ticket);
                db.QuinielaWalletMovements.Add(wallet.TryChargeTicket(ticket.Id, jornada.Price, Utc(3, 3))!);
                ticket.MarkPaid(QuinielaPaymentMethod.Wallet, Utc(3, 3));
                return ticket;
            });
        }

        [Fact]
        public async Task Handle_PlayerOfTheTeam_ReadsTheTeamTransactions()
        {
            var seed = await SeedTeamAsync(_fixture);
            var teamPlayerId = await TeamPlayerAsync(seed);
            await SaveAsync(db => db.TeamPlayerSanctions.Add(Sanction(teamPlayerId, Utc(3, 1), fine: 100m)));

            var rows = await HandleAsync(seed.TeamId, seed.PlayerId);

            Assert.Single(rows);
            Assert.Equal("Sanction", rows[0].Type);
        }

        [Fact]
        public async Task Handle_CoachOfTheClubOwningTheTeam_ReadsTheTeamTransactions()
        {
            var seed = await SeedTeamAsync(_fixture);
            var teamPlayerId = await TeamPlayerAsync(seed);
            await SaveAsync(db => db.TeamPlayerSanctions.Add(Sanction(teamPlayerId, Utc(3, 1), fine: 100m)));

            var rows = await HandleAsync(seed.TeamId, seed.ClubCoachId);

            Assert.Single(rows);
        }

        [Fact]
        public async Task Handle_UserOfAnotherTeam_ThrowsForbiddenAccessException()
        {
            var seed = await SeedTeamAsync(_fixture);
            var teamPlayerId = await TeamPlayerAsync(seed);
            await SaveAsync(db => db.TeamPlayerSanctions.Add(Sanction(teamPlayerId, Utc(3, 1), fine: 100m)));

            await Assert.ThrowsAsync<ForbiddenAccessException>(() => HandleAsync(seed.TeamId, seed.OutsiderId));
        }

        [Fact]
        public async Task Handle_TeamWithoutTransactions_ReturnsEmptyList()
        {
            var seed = await SeedTeamAsync(_fixture);

            var rows = await HandleAsync(seed.TeamId, seed.CoachId);

            Assert.NotNull(rows);
            Assert.Empty(rows);
        }

        [Fact]
        public async Task Handle_SanctionWithFine_ListsSanctionWithStartDateAndPlayerName()
        {
            var seed = await SeedTeamAsync(_fixture);
            var teamPlayerId = await TeamPlayerAsync(seed);
            await SaveAsync(db => db.TeamPlayerSanctions.Add(Sanction(teamPlayerId, Utc(3, 1), fine: 100m)));

            var rows = await HandleAsync(seed.TeamId, seed.CoachId);

            var row = Assert.Single(rows);
            Assert.Equal("Sanction", row.Type);
            Assert.Equal<DateTime?>(Utc(3, 1), row.Date);
            Assert.Equal("Ana Lopez", row.PersonName);
        }

        [Fact]
        public async Task Handle_SanctionWithNullFine_IsNotListed()
        {
            var seed = await SeedTeamAsync(_fixture);
            var teamPlayerId = await TeamPlayerAsync(seed);
            await SaveAsync(db =>
            {
                db.TeamPlayerSanctions.Add(Sanction(teamPlayerId, Utc(3, 1), fine: null));
                db.TeamPlayerSanctions.Add(Sanction(teamPlayerId, Utc(3, 2), fine: 100m));
                return 0;
            });

            var rows = await HandleAsync(seed.TeamId, seed.CoachId);

            Assert.Equal<DateTime?>(Utc(3, 2), Assert.Single(rows).Date);
        }

        [Fact]
        public async Task Handle_SanctionWithZeroFine_IsNotListed()
        {
            var seed = await SeedTeamAsync(_fixture);
            var teamPlayerId = await TeamPlayerAsync(seed);
            await SaveAsync(db =>
            {
                db.TeamPlayerSanctions.Add(Sanction(teamPlayerId, Utc(3, 1), fine: 0m));
                db.TeamPlayerSanctions.Add(Sanction(teamPlayerId, Utc(3, 2), fine: 100m));
                return 0;
            });

            var rows = await HandleAsync(seed.TeamId, seed.CoachId);

            Assert.Equal<DateTime?>(Utc(3, 2), Assert.Single(rows).Date);
        }

        [Fact]
        public async Task Handle_PartiallyPaidSanction_IsPendingWithOutstandingAmount()
        {
            var seed = await SeedTeamAsync(_fixture);
            var teamPlayerId = await TeamPlayerAsync(seed);
            await SaveAsync(db => db.TeamPlayerSanctions.Add(Sanction(teamPlayerId, Utc(3, 1), fine: 100m, amountPaid: 40m)));

            var rows = await HandleAsync(seed.TeamId, seed.CoachId);

            var row = Assert.Single(rows);
            Assert.Equal("Pending", row.Status);
            Assert.Equal<decimal?>(60m, row.PendingAmount);
        }

        [Fact]
        public async Task Handle_FullyPaidSanction_IsPaidWithoutPendingAmount()
        {
            var seed = await SeedTeamAsync(_fixture);
            var teamPlayerId = await TeamPlayerAsync(seed);
            await SaveAsync(db => db.TeamPlayerSanctions.Add(Sanction(teamPlayerId, Utc(3, 1), fine: 100m, amountPaid: 100m)));

            var rows = await HandleAsync(seed.TeamId, seed.CoachId);

            var row = Assert.Single(rows);
            Assert.Equal("Paid", row.Status);
            Assert.Null(row.PendingAmount);
        }

        [Fact]
        public async Task Handle_SanctionWithoutPaymentRecorded_IsPendingForWholeFine()
        {
            var seed = await SeedTeamAsync(_fixture);
            var teamPlayerId = await TeamPlayerAsync(seed);
            await SaveAsync(db => db.TeamPlayerSanctions.Add(Sanction(teamPlayerId, Utc(3, 1), fine: 50m, amountPaid: null)));

            var rows = await HandleAsync(seed.TeamId, seed.CoachId);

            var row = Assert.Single(rows);
            Assert.Equal("Pending", row.Status);
            Assert.Equal<decimal?>(50m, row.PendingAmount);
        }

        [Fact]
        public async Task Handle_SanctionPaymentFundMovement_IsNotListedSeparately()
        {
            var seed = await SeedTeamAsync(_fixture);
            var teamPlayerId = await TeamPlayerAsync(seed);
            var sanction = await SaveAsync(db => db.TeamPlayerSanctions.Add(Sanction(teamPlayerId, Utc(3, 1), fine: 100m, amountPaid: 40m)).Entity);
            await SaveAsync(db => db.TeamFundMovements.Add(TeamFundMovement.Create(
                seed.TeamId, 40m, TeamFundMovementSource.SanctionPayment, sourceSanctionId: sanction.Id, occurredAt: Utc(3, 1))));

            var rows = await HandleAsync(seed.TeamId, seed.CoachId);

            var row = Assert.Single(rows);
            Assert.Equal("Sanction", row.Type);
        }

        [Fact]
        public async Task Handle_LotteryBookNotReturned_IsPendingForTicketPriceTimesTicketsPerBook()
        {
            var seed = await SeedTeamAsync(_fixture);
            var teamPlayerId = await TeamPlayerAsync(seed);
            await SaveAsync(db =>
            {
                var campaign = Campaign(seed.TeamId, ticketPrice: 2m, ticketsPerBook: 10);
                campaign.DeliverBook(teamPlayerId.ToString(), 1, 1, new DateOnly(2026, 2, 20));
                db.LotteryCampaigns.Add(campaign);
                return campaign;
            });

            var rows = await HandleAsync(seed.TeamId, seed.CoachId);

            var row = Assert.Single(rows);
            Assert.Equal("Lottery", row.Type);
            Assert.Equal("Pending", row.Status);
            Assert.Equal(20m, row.Amount);
            Assert.Equal<decimal?>(20m, row.PendingAmount);
            Assert.Equal("Ana Lopez", row.PersonName);
        }

        [Fact]
        public async Task Handle_LotteryBookReturned_IsPaidWithReturnedAmount()
        {
            var seed = await SeedTeamAsync(_fixture);
            var teamPlayerId = await TeamPlayerAsync(seed);
            await SaveAsync(db =>
            {
                var campaign = Campaign(seed.TeamId, ticketPrice: 5m, ticketsPerBook: 10);
                var book = campaign.DeliverBook(teamPlayerId.ToString(), 1, 1, new DateOnly(2026, 2, 20));
                campaign.ReturnBook(book.Id, 15m, new DateOnly(2026, 3, 2));
                db.LotteryCampaigns.Add(campaign);
                return campaign;
            });

            var rows = await HandleAsync(seed.TeamId, seed.CoachId);

            var row = Assert.Single(rows);
            Assert.Equal("Paid", row.Status);
            Assert.Equal(15m, row.Amount);
            Assert.Null(row.PendingAmount);
        }

        [Fact]
        public async Task Handle_LotteryBookReturned_UsesReturnedOnAsDate()
        {
            var seed = await SeedTeamAsync(_fixture);
            var teamPlayerId = await TeamPlayerAsync(seed);
            await SaveAsync(db =>
            {
                var campaign = Campaign(seed.TeamId, ticketPrice: 5m, ticketsPerBook: 10);
                var book = campaign.DeliverBook(teamPlayerId.ToString(), 1, 1, new DateOnly(2026, 2, 20));
                campaign.ReturnBook(book.Id, 15m, new DateOnly(2026, 3, 2));
                db.LotteryCampaigns.Add(campaign);
                return campaign;
            });

            var rows = await HandleAsync(seed.TeamId, seed.CoachId);

            Assert.Equal<DateTime?>(Utc(3, 2), Assert.Single(rows).Date);
        }

        [Fact]
        public async Task Handle_LotteryBookNotReturned_UsesDeliveredOnAsDate()
        {
            var seed = await SeedTeamAsync(_fixture);
            var teamPlayerId = await TeamPlayerAsync(seed);
            await SaveAsync(db =>
            {
                var campaign = Campaign(seed.TeamId);
                campaign.DeliverBook(teamPlayerId.ToString(), 1, 1, new DateOnly(2026, 2, 20));
                db.LotteryCampaigns.Add(campaign);
                return campaign;
            });

            var rows = await HandleAsync(seed.TeamId, seed.CoachId);

            Assert.Equal<DateTime?>(Utc(2, 20), Assert.Single(rows).Date);
        }

        [Fact]
        public async Task Handle_PaidQuinielaTicket_IsPaidAtJornadaPriceAndOnPaidAtDate()
        {
            var seed = await SeedTeamAsync(_fixture);
            var suffix = Suffix();
            var jornada = await JornadaAsync(seed, suffix);
            await SeedTicketAsync(_fixture, jornada.Id, seed.PlayerId, suffix, QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away, paid: true);

            var rows = await HandleAsync(seed.TeamId, seed.CoachId);

            var row = Assert.Single(rows);
            Assert.Equal("Quiniela", row.Type);
            Assert.Equal("Paid", row.Status);
            Assert.Equal(jornada.Price, row.Amount);
            Assert.Equal<DateTime?>(BeforeKickoff, row.Date);
        }

        [Fact]
        public async Task Handle_UnpaidQuinielaTicket_UsesPaymentDeadlineAsDate()
        {
            var seed = await SeedTeamAsync(_fixture);
            var suffix = Suffix();
            var jornada = await JornadaAsync(seed, suffix);
            await SaveAsync(db => db.QuinielaTickets.Add(NewTicket(jornada.Id, seed.PlayerId, suffix)));

            var rows = await HandleAsync(seed.TeamId, seed.CoachId);

            var row = Assert.Single(rows);
            Assert.Equal<DateTime?>(QuinielaSchedule.PaymentDeadlineUtc(new DateOnly(2026, 11, 7)), row.Date);
        }

        [Fact]
        public async Task Handle_UnpaidQuinielaTicketPastItsDeadline_StaysPendingWithPriceAsPendingAmount()
        {
            var seed = await SeedTeamAsync(_fixture);
            var suffix = Suffix();
            var roundId = await SeedRoundAsync(_fixture, seed.GroupCode, 3,
                Match($"A{suffix}", "06/09/2025", "16:00"),
                Match($"B{suffix}", "06/09/2025", "18:00"),
                Match($"C{suffix}", "07/09/2025", "12:00"));
            var jornada = await SeedJornadaAsync(_fixture, seed.TeamId, roundId);
            await SaveAsync(db => db.QuinielaTickets.Add(NewTicket(jornada.Id, seed.PlayerId, suffix)));

            var rows = await HandleAsync(seed.TeamId, seed.CoachId);

            var row = Assert.Single(rows);
            Assert.Equal("Pending", row.Status);
            Assert.Equal<decimal?>(jornada.Price, row.PendingAmount);
        }

        [Fact]
        public async Task Handle_UnpaidQuinielaTicketWithoutDerivableDeadline_HasNoDate()
        {
            var seed = await SeedTeamAsync(_fixture);
            var suffix = Suffix();
            var roundId = await SeedRoundAsync(_fixture, seed.GroupCode, 2,
                Match($"A{suffix}", "07/11/2026", "16:00", statusReason: "Aplazado"),
                Match($"B{suffix}", "07/11/2026", "18:00", statusReason: "Aplazado"));
            var jornada = await SeedJornadaAsync(_fixture, seed.TeamId, roundId);
            await SaveAsync(db => db.QuinielaTickets.Add(NewTicket(jornada.Id, seed.PlayerId, suffix)));

            var rows = await HandleAsync(seed.TeamId, seed.CoachId);

            Assert.Null(Assert.Single(rows).Date);
        }

        [Fact]
        public async Task Handle_QuinielaFundMovements_AreListedAsPaidQuinielaTransactionsWithoutPersonName()
        {
            var seed = await SeedTeamAsync(_fixture);
            await SaveAsync(db =>
            {
                db.TeamFundMovements.Add(TeamFundMovement.Create(seed.TeamId, 30m, TeamFundMovementSource.QuinielaFund, occurredAt: Utc(3, 4)));
                db.TeamFundMovements.Add(TeamFundMovement.Create(seed.TeamId, 10m, TeamFundMovementSource.QuinielaDonation, occurredAt: Utc(3, 5)));
                return 0;
            });

            var rows = await HandleAsync(seed.TeamId, seed.CoachId);

            Assert.Equal(2, rows.Count);
            Assert.All(rows, row =>
            {
                Assert.Equal("Quiniela", row.Type);
                Assert.Equal("Paid", row.Status);
                Assert.Null(row.PersonName);
            });
            Assert.Contains(rows, row => row.Amount == 30m && row.Date == Utc(3, 4));
            Assert.Contains(rows, row => row.Amount == 10m && row.Date == Utc(3, 5));
        }

        [Fact]
        public async Task Handle_WalletTopUp_ListedAsPaidWalletTopUpWithOwnerName()
        {
            var seed = await SeedTeamAsync(_fixture);
            await SaveAsync(db =>
            {
                db.UserPersonalData.Add(UserPersonalData.Create(seed.PlayerId, "Marta", "Ruiz", null, null));
                var wallet = QuinielaWallet.Create(seed.TeamId, seed.PlayerId);
                db.QuinielaWallets.Add(wallet);
                db.QuinielaWalletMovements.Add(wallet.TopUp(5m, seed.PlayerId, "Recarga", Utc(3, 3)));
                return wallet;
            });

            var rows = await HandleAsync(seed.TeamId, seed.CoachId);

            var row = Assert.Single(rows);
            Assert.Equal("WalletTopUp", row.Type);
            Assert.Equal("Paid", row.Status);
            Assert.Equal(5m, row.Amount);
            Assert.Equal<DateTime?>(Utc(3, 3), row.Date);
            Assert.Equal("Marta Ruiz", row.PersonName);
        }

        [Fact]
        public async Task Handle_TicketPaidFromWallet_IsListedAsTicketAndAsWalletCharge()
        {
            var seed = await SeedTeamAsync(_fixture);
            var jornada = await JornadaAsync(seed, Suffix());
            await SeedWalletChargeAsync(seed, jornada, Suffix());

            var rows = await HandleAsync(seed.TeamId, seed.CoachId);

            var ticketRow = Assert.Single(rows, row => row.Type == "Quiniela");
            Assert.Equal("Paid", ticketRow.Status);
            var chargeRow = Assert.Single(rows, row => row.Type == "WalletCharge");
            Assert.Equal("Paid", chargeRow.Status);
            Assert.Equal(jornada.Price, chargeRow.Amount);
            Assert.Equal<DateTime?>(Utc(3, 3), chargeRow.Date);
        }

        [Fact]
        public async Task Handle_WalletMovementsOtherThanTopUpAndCharge_AreNotListed()
        {
            var seed = await SeedTeamAsync(_fixture);
            var suffix = Suffix();
            var jornada = await JornadaAsync(seed, suffix);
            await SaveAsync(db =>
            {
                var wallet = QuinielaWallet.Create(seed.TeamId, seed.PlayerId);
                db.QuinielaWallets.Add(wallet);
                db.QuinielaWalletMovements.Add(wallet.TopUp(5m, seed.PlayerId, "Recarga", Utc(3, 2)));
                var ticket = NewTicket(jornada.Id, seed.PlayerId, suffix);
                db.QuinielaTickets.Add(ticket);
                db.QuinielaWalletMovements.Add(wallet.CreditPrize(ticket.Id, 2m, Utc(3, 3), "Premio"));
                db.QuinielaWalletMovements.Add(wallet.Adjust(1m, seed.CoachId, "Ajuste", Utc(3, 4)));
                db.QuinielaWalletMovements.Add(wallet.RefundTicket(ticket.Id, 1m, Utc(3, 5)));
                db.QuinielaWalletMovements.Add(wallet.Donate(1m, Utc(3, 6), "Donación"));
                return wallet;
            });

            var rows = await HandleAsync(seed.TeamId, seed.CoachId);

            Assert.Equal(new[] { "Quiniela", "WalletTopUp" }, rows.Select(row => row.Type).OrderBy(type => type).ToArray());
        }

        [Fact]
        public async Task Handle_TransactionsOrderedNewestFirst()
        {
            var seed = await SeedTeamAsync(_fixture);
            var teamPlayerId = await TeamPlayerAsync(seed);
            await SaveAsync(db =>
            {
                db.TeamPlayerSanctions.Add(Sanction(teamPlayerId, Utc(3, 1), fine: 10m));
                db.TeamPlayerSanctions.Add(Sanction(teamPlayerId, Utc(3, 5), fine: 10m));
                db.TeamPlayerSanctions.Add(Sanction(teamPlayerId, Utc(3, 3), fine: 10m));
                return 0;
            });

            var rows = await HandleAsync(seed.TeamId, seed.CoachId);

            Assert.Equal(new DateTime?[] { Utc(3, 5), Utc(3, 3), Utc(3, 1) }, rows.Select(row => row.Date).ToArray());
        }

        [Fact]
        public async Task Handle_UndatedTransaction_IsOrderedAfterDatedTransactions()
        {
            var seed = await SeedTeamAsync(_fixture);
            var teamPlayerId = await TeamPlayerAsync(seed);
            var suffix = Suffix();
            var roundId = await SeedRoundAsync(_fixture, seed.GroupCode, 2,
                Match($"A{suffix}", "07/11/2026", "16:00", statusReason: "Aplazado"),
                Match($"B{suffix}", "07/11/2026", "18:00", statusReason: "Aplazado"));
            var jornada = await SeedJornadaAsync(_fixture, seed.TeamId, roundId);
            await SaveAsync(db => db.QuinielaTickets.Add(NewTicket(jornada.Id, seed.PlayerId, suffix)));
            await SaveAsync(db => db.TeamPlayerSanctions.Add(Sanction(teamPlayerId, Utc(3, 1), fine: 10m)));

            var rows = await HandleAsync(seed.TeamId, seed.CoachId);

            Assert.Equal(new[] { "Sanction", "Quiniela" }, rows.Select(row => row.Type).ToArray());
            Assert.Null(rows[1].Date);
        }

        [Fact]
        public async Task Handle_MixedTypes_AreOrderedByTheirSourceDates()
        {
            var seed = await SeedTeamAsync(_fixture);
            var teamPlayerId = await TeamPlayerAsync(seed);
            var suffix = Suffix();
            var jornada = await JornadaAsync(seed, suffix);
            await SaveAsync(db =>
            {
                db.TeamPlayerSanctions.Add(Sanction(teamPlayerId, Utc(3, 1), fine: 10m));
                var wallet = QuinielaWallet.Create(seed.TeamId, seed.PlayerId);
                db.QuinielaWallets.Add(wallet);
                db.QuinielaWalletMovements.Add(wallet.TopUp(5m, seed.PlayerId, "Recarga", Utc(3, 3)));
                var ticket = NewTicket(jornada.Id, seed.PlayerId, suffix);
                ticket.MarkPaid(QuinielaPaymentMethod.Cash, Utc(3, 5));
                db.QuinielaTickets.Add(ticket);
                return ticket;
            });

            var rows = await HandleAsync(seed.TeamId, seed.CoachId);

            Assert.Equal(new[] { "Quiniela", "WalletTopUp", "Sanction" }, rows.Select(row => row.Type).ToArray());
        }

        [Fact]
        public async Task Handle_StatusFilterPending_ReturnsOnlyPendingTransactions()
        {
            var seed = await SeedTeamAsync(_fixture);
            var teamPlayerId = await TeamPlayerAsync(seed);
            await SaveAsync(db =>
            {
                db.TeamPlayerSanctions.Add(Sanction(teamPlayerId, Utc(3, 1), fine: 100m));
                db.TeamPlayerSanctions.Add(Sanction(teamPlayerId, Utc(3, 2), fine: 50m, amountPaid: 50m));
                return 0;
            });

            var rows = await HandleAsync(seed.TeamId, seed.CoachId, status: TransactionStatus.Pending);

            var row = Assert.Single(rows);
            Assert.Equal("Pending", row.Status);
        }

        [Fact]
        public async Task Handle_TypeFilterLottery_ReturnsOnlyLotteryTransactions()
        {
            var seed = await SeedTeamAsync(_fixture);
            var teamPlayerId = await TeamPlayerAsync(seed);
            await SaveAsync(db =>
            {
                db.TeamPlayerSanctions.Add(Sanction(teamPlayerId, Utc(3, 1), fine: 100m));
                var campaign = Campaign(seed.TeamId);
                campaign.DeliverBook(teamPlayerId.ToString(), 1, 1, new DateOnly(2026, 2, 20));
                db.LotteryCampaigns.Add(campaign);
                return campaign;
            });

            var rows = await HandleAsync(seed.TeamId, seed.CoachId, type: TransactionType.Lottery);

            var row = Assert.Single(rows);
            Assert.Equal("Lottery", row.Type);
        }

        [Fact]
        public async Task Handle_StatusAndTypeFilters_CombineToPaidSanctions()
        {
            var seed = await SeedTeamAsync(_fixture);
            var teamPlayerId = await TeamPlayerAsync(seed);
            await SaveAsync(db =>
            {
                db.TeamPlayerSanctions.Add(Sanction(teamPlayerId, Utc(3, 1), fine: 50m, amountPaid: 50m));
                db.TeamPlayerSanctions.Add(Sanction(teamPlayerId, Utc(3, 2), fine: 100m));
                var campaign = Campaign(seed.TeamId, ticketPrice: 5m, ticketsPerBook: 10);
                var book = campaign.DeliverBook(teamPlayerId.ToString(), 1, 1, new DateOnly(2026, 2, 20));
                campaign.ReturnBook(book.Id, 15m, new DateOnly(2026, 3, 2));
                db.LotteryCampaigns.Add(campaign);
                return campaign;
            });

            var rows = await HandleAsync(seed.TeamId, seed.CoachId, status: TransactionStatus.Paid, type: TransactionType.Sanction);

            var row = Assert.Single(rows);
            Assert.Equal("Sanction", row.Type);
            Assert.Equal("Paid", row.Status);
        }

        [Fact]
        public async Task Handle_TypeFilterQuiniela_ReturnsTicketsAndFundMovementsOnly()
        {
            var seed = await SeedTeamAsync(_fixture);
            var teamPlayerId = await TeamPlayerAsync(seed);
            var suffix = Suffix();
            var jornada = await JornadaAsync(seed, suffix);
            await SaveAsync(db => db.QuinielaTickets.Add(NewTicket(jornada.Id, seed.PlayerId, suffix)));
            await SaveAsync(db =>
            {
                db.TeamFundMovements.Add(TeamFundMovement.Create(seed.TeamId, 30m, TeamFundMovementSource.QuinielaFund, occurredAt: Utc(3, 4)));
                db.TeamPlayerSanctions.Add(Sanction(teamPlayerId, Utc(3, 1), fine: 10m));
                return 0;
            });

            var rows = await HandleAsync(seed.TeamId, seed.CoachId, type: TransactionType.Quiniela);

            Assert.Equal(2, rows.Count);
            Assert.All(rows, row => Assert.Equal("Quiniela", row.Type));
        }

        [Fact]
        public async Task Handle_TypeFilterWalletCharge_ReturnsChargesOnly()
        {
            var seed = await SeedTeamAsync(_fixture);
            var jornada = await JornadaAsync(seed, Suffix());
            await SeedWalletChargeAsync(seed, jornada, Suffix());

            var rows = await HandleAsync(seed.TeamId, seed.CoachId, type: TransactionType.WalletCharge);

            var row = Assert.Single(rows);
            Assert.Equal("WalletCharge", row.Type);
        }
    }
}
