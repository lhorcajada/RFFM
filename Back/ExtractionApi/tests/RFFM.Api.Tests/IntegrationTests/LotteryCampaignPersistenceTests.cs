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
        public async Task CampaignWithBooks_RoundTrips()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, _) = await PlayerModelObservationPersistenceTests.SeedAsync(db);
            var campaign = LotteryCampaign.Create(teamId, "Lotería de Navidad 2026", new DateOnly(2026, 12, 22), 5m, 15,
                new DateOnly(2026, 12, 9), new DateOnly(2026, 12, 15));
            var returned = campaign.DeliverBook(teamPlayerId, 12, 166, new DateOnly(2026, 11, 20));
            campaign.DeliverBook(teamPlayerId, 13, 181, new DateOnly(2026, 11, 21));
            campaign.ReturnBook(returned.Id, 60m, new DateOnly(2026, 12, 1));
            campaign.RecordClubDelivery(60m, new DateOnly(2026, 12, 10));
            db.LotteryCampaigns.Add(campaign);
            await db.SaveChangesAsync();

            await using var readDb = _fixture.CreateDbContext();
            var stored = await readDb.LotteryCampaigns
                .AsNoTracking()
                .Include(c => c.Books)
                .SingleAsync(c => c.Id == campaign.Id);

            Assert.Equal(5m, stored.TicketPrice);
            Assert.Equal(new DateOnly(2026, 12, 10), stored.ClubDeliveredOn);
            Assert.Equal(60m, stored.ClubDeliveredAmount);
            Assert.Equal(2, stored.Books.Count);
            var book = stored.Books.Single(b => b.BookNumber == 12);
            Assert.Equal(60m, book.AmountReturned);
            Assert.Equal(new DateOnly(2026, 12, 1), book.ReturnedOn);
            Assert.Equal(12, stored.TicketsSold(book));
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
            reloaded.DeliverBook(teamPlayerId, 2, 100, new DateOnly(2026, 11, 20));
            await otherDb.SaveChangesAsync();

            await using var readDb = _fixture.CreateDbContext();
            var stored = await readDb.LotteryBooks.CountAsync(b => b.LotteryCampaignId == campaign.Id);
            Assert.Equal(2, stored);
        }
    }
}
