#nullable enable
using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class LotteryCampaignPersistenceTests
    {
        private readonly PostgresContainerFixture _fixture;

        public LotteryCampaignPersistenceTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task CampaignWithBooksInEveryStatus_RoundTrips()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, _) = await PlayerModelObservationPersistenceTests.SeedAsync(db);
            var campaign = LotteryCampaign.Create(teamId, "Lotería de Navidad 2026", new DateOnly(2026, 12, 22), 5m, 15,
                new DateOnly(2026, 12, 9), new DateOnly(2026, 12, 15));
            var delivered = campaign.DeliverBook(teamPlayerId, 12, 166, new DateOnly(2026, 11, 20));
            var toClub = campaign.DeliverBook(teamPlayerId, 13, 181, new DateOnly(2026, 11, 21));
            campaign.ReturnBook(toClub.Id, 60m, new DateOnly(2026, 12, 1));
            campaign.AdvanceBook(toClub.Id, new DateOnly(2026, 12, 10), null);
            campaign.CreateBooks(1);
            db.LotteryCampaigns.Add(campaign);
            await db.SaveChangesAsync();

            await using var readDb = _fixture.CreateDbContext();
            var stored = await readDb.LotteryCampaigns
                .AsNoTracking()
                .Include(c => c.Books)
                .SingleAsync(c => c.Id == campaign.Id);

            Assert.Equal(5m, stored.TicketPrice);
            Assert.Equal(3, stored.Books.Count);
            var storedToClub = stored.Books.Single(b => b.BookNumber == 13);
            Assert.Equal(LotteryBookStatus.DeliveredToClub, storedToClub.Status);
            Assert.Equal(60m, storedToClub.AmountReturned);
            Assert.Equal(new DateOnly(2026, 12, 1), storedToClub.ReturnedOn);
            Assert.Equal(new DateOnly(2026, 12, 10), storedToClub.ClubDeliveredOn);
            Assert.Equal(195, storedToClub.LastTicketNumber);
            Assert.Equal(12, stored.TicketsSold(storedToClub));
            Assert.Equal(LotteryBookStatus.DeliveredToPlayer, stored.Books.Single(b => b.Id == delivered.Id).Status);
            var unassigned = stored.Books.Single(b => b.Status == LotteryBookStatus.Unassigned);
            Assert.Null(unassigned.TeamPlayerId);
            Assert.Null(unassigned.DeliveredOn);
        }

        [Fact]
        public async Task AddingABookToAStoredCampaign_PersistsIt()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, _) = await PlayerModelObservationPersistenceTests.SeedAsync(db);
            var campaign = LotteryCampaign.Create(teamId, "Navidad", new DateOnly(2026, 12, 22), 5m, 15,
                new DateOnly(2026, 12, 9), new DateOnly(2026, 12, 15));
            campaign.DeliverBook(teamPlayerId, 1, 1, new DateOnly(2026, 11, 20));
            db.LotteryCampaigns.Add(campaign);
            await db.SaveChangesAsync();

            await using var otherDb = _fixture.CreateDbContext();
            var reloaded = await otherDb.LotteryCampaigns.Include(c => c.Books).SingleAsync(c => c.Id == campaign.Id);
            otherDb.LotteryBooks.Add(reloaded.AssignBook(null, teamPlayerId, 2, 100, 114));
            await otherDb.SaveChangesAsync();

            await using var readDb = _fixture.CreateDbContext();
            var stored = await readDb.LotteryBooks.CountAsync(b => b.LotteryCampaignId == campaign.Id);
            Assert.Equal(2, stored);
        }
    }
}
