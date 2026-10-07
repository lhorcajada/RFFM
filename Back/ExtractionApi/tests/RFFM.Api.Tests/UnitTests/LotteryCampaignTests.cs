#nullable enable
using System;
using System.Linq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Teams;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class LotteryCampaignTests
    {
        private static readonly DateOnly DrawDate = new(2026, 12, 22);
        private static readonly DateOnly ClubFrom = new(2026, 12, 9);
        private static readonly DateOnly ClubTo = new(2026, 12, 15);
        private static readonly DateOnly Delivered = new(2026, 11, 20);

        private static LotteryCampaign Campaign(decimal price = 5m, int ticketsPerBook = 15) =>
            LotteryCampaign.Create("team-1", "Lotería de Navidad 2026", DrawDate, price, ticketsPerBook, ClubFrom, ClubTo);

        [Fact]
        public void Create_StoresConfiguration()
        {
            var campaign = LotteryCampaign.Create("team-1", "  Lotería de Navidad 2026  ", DrawDate, 5m, 15, ClubFrom, ClubTo);

            Assert.Equal("team-1", campaign.TeamId);
            Assert.Equal("Lotería de Navidad 2026", campaign.Name);
            Assert.Equal(DrawDate, campaign.DrawDate);
            Assert.Equal(5m, campaign.TicketPrice);
            Assert.Equal(15, campaign.TicketsPerBook);
            Assert.Equal(ClubFrom, campaign.ClubDeliveryFrom);
            Assert.Equal(ClubTo, campaign.ClubDeliveryTo);
            Assert.Empty(campaign.Books);
            Assert.Null(campaign.ClubDeliveredOn);
        }

        [Theory]
        [InlineData(0, 15)]
        [InlineData(-5, 15)]
        [InlineData(5, 0)]
        [InlineData(5, 101)]
        public void Create_WithInvalidPriceOrBookSize_Throws(decimal price, int ticketsPerBook)
        {
            var ex = Assert.Throws<DomainException>(() => Campaign(price, ticketsPerBook));
            Assert.Equal(ErrorCodes.LotteryInvalidCampaign, ex.Code);
        }

        [Fact]
        public void Create_WithBlankName_Throws()
        {
            var ex = Assert.Throws<DomainException>(() =>
                LotteryCampaign.Create("team-1", "  ", DrawDate, 5m, 15, ClubFrom, ClubTo));
            Assert.Equal(ErrorCodes.LotteryInvalidCampaign, ex.Code);
        }

        [Fact]
        public void Create_WithClubWindowAfterDraw_Throws()
        {
            var ex = Assert.Throws<DomainException>(() =>
                LotteryCampaign.Create("team-1", "Navidad", DrawDate, 5m, 15, ClubFrom, DrawDate.AddDays(1)));
            Assert.Equal(ErrorCodes.LotteryInvalidClubDeliveryWindow, ex.Code);
        }

        [Fact]
        public void Create_WithInvertedClubWindow_Throws()
        {
            var ex = Assert.Throws<DomainException>(() =>
                LotteryCampaign.Create("team-1", "Navidad", DrawDate, 5m, 15, ClubTo, ClubFrom));
            Assert.Equal(ErrorCodes.LotteryInvalidClubDeliveryWindow, ex.Code);
        }

        [Fact]
        public void DeliverBook_ComputesRange()
        {
            var campaign = Campaign();

            var book = campaign.DeliverBook("tp-1", 12, 166, Delivered);

            Assert.Equal("tp-1", book.TeamPlayerId);
            Assert.Equal(12, book.BookNumber);
            Assert.Equal(166, book.FirstTicketNumber);
            Assert.Equal(180, campaign.LastTicketNumber(book));
            Assert.Equal(Delivered, book.DeliveredOn);
            Assert.False(book.IsReturned);
        }

        [Fact]
        public void DeliverBook_AllowsSeveralBooksPerPlayer()
        {
            var campaign = Campaign();
            campaign.DeliverBook("tp-1", 1, 1, Delivered);
            campaign.DeliverBook("tp-1", 2, 16, Delivered);

            Assert.Equal(2, campaign.Books.Count(b => b.TeamPlayerId == "tp-1"));
        }

        [Fact]
        public void DeliverBook_WithDuplicatedNumber_Throws()
        {
            var campaign = Campaign();
            campaign.DeliverBook("tp-1", 12, 166, Delivered);

            var ex = Assert.Throws<DomainException>(() => campaign.DeliverBook("tp-2", 12, 500, Delivered));
            Assert.Equal(ErrorCodes.LotteryBookNumberDuplicated, ex.Code);
        }

        [Theory]
        [InlineData(152)]
        [InlineData(180)]
        [InlineData(170)]
        public void DeliverBook_WithOverlappingRange_Throws(int firstTicket)
        {
            var campaign = Campaign();
            campaign.DeliverBook("tp-1", 12, 166, Delivered);

            var ex = Assert.Throws<DomainException>(() => campaign.DeliverBook("tp-2", 13, firstTicket, Delivered));
            Assert.Equal(ErrorCodes.LotteryTicketRangeOverlap, ex.Code);
        }

        [Fact]
        public void DeliverBook_WithAdjacentRange_Succeeds()
        {
            var campaign = Campaign();
            campaign.DeliverBook("tp-1", 12, 166, Delivered);

            campaign.DeliverBook("tp-2", 11, 151, Delivered);
            campaign.DeliverBook("tp-3", 13, 181, Delivered);

            Assert.Equal(3, campaign.Books.Count);
        }

        [Fact]
        public void EditBook_ChangesPlayerNumberAndDate()
        {
            var campaign = Campaign();
            var book = campaign.DeliverBook("tp-1", 12, 166, Delivered);

            campaign.EditBook(book.Id, "tp-2", 20, 300, Delivered.AddDays(1));

            Assert.Equal("tp-2", book.TeamPlayerId);
            Assert.Equal(20, book.BookNumber);
            Assert.Equal(300, book.FirstTicketNumber);
            Assert.Equal(Delivered.AddDays(1), book.DeliveredOn);
        }

        [Fact]
        public void EditBook_KeepingItsOwnRange_DoesNotOverlapWithItself()
        {
            var campaign = Campaign();
            var book = campaign.DeliverBook("tp-1", 12, 166, Delivered);

            campaign.EditBook(book.Id, "tp-1", 12, 170, Delivered);

            Assert.Equal(170, book.FirstTicketNumber);
        }

        [Fact]
        public void EditBook_Unknown_ThrowsNotFound()
        {
            var ex = Assert.Throws<NotFoundException>(() => Campaign().EditBook("nope", "tp-1", 1, 1, Delivered));
            Assert.Equal(ErrorCodes.LotteryBookNotFound, ex.Code);
        }

        [Fact]
        public void ReturnBook_StoresAmountAndComputesSoldTickets()
        {
            var campaign = Campaign();
            var book = campaign.DeliverBook("tp-1", 12, 166, Delivered);

            campaign.ReturnBook(book.Id, 60m, Delivered.AddDays(10));

            Assert.True(book.IsReturned);
            Assert.Equal(60m, book.AmountReturned);
            Assert.Equal(Delivered.AddDays(10), book.ReturnedOn);
            Assert.Equal(12, campaign.TicketsSold(book));
            Assert.Equal(3, campaign.TicketsUnsold(book));
        }

        [Theory]
        [InlineData(62)]
        [InlineData(80)]
        [InlineData(-5)]
        public void ReturnBook_WithInvalidAmount_Throws(decimal amount)
        {
            var campaign = Campaign();
            var book = campaign.DeliverBook("tp-1", 12, 166, Delivered);

            var ex = Assert.Throws<DomainException>(() => campaign.ReturnBook(book.Id, amount, Delivered));
            Assert.Equal(ErrorCodes.LotteryInvalidReturnAmount, ex.Code);
        }

        [Fact]
        public void ReturnBook_WithZero_MeansNothingSold()
        {
            var campaign = Campaign();
            var book = campaign.DeliverBook("tp-1", 12, 166, Delivered);

            campaign.ReturnBook(book.Id, 0m, Delivered);

            Assert.True(book.IsReturned);
            Assert.Equal(0, campaign.TicketsSold(book));
            Assert.Equal(15, campaign.TicketsUnsold(book));
        }

        [Fact]
        public void ReturnBook_BeforeDelivery_Throws()
        {
            var campaign = Campaign();
            var book = campaign.DeliverBook("tp-1", 12, 166, Delivered);

            var ex = Assert.Throws<DomainException>(() => campaign.ReturnBook(book.Id, 75m, Delivered.AddDays(-1)));
            Assert.Equal(ErrorCodes.LotteryReturnBeforeDelivery, ex.Code);
        }

        [Fact]
        public void UndoReturn_LeavesBookPending()
        {
            var campaign = Campaign();
            var book = campaign.DeliverBook("tp-1", 12, 166, Delivered);
            campaign.ReturnBook(book.Id, 75m, Delivered);

            campaign.UndoReturn(book.Id);

            Assert.False(book.IsReturned);
            Assert.Null(book.AmountReturned);
            Assert.Null(book.ReturnedOn);
        }

        [Fact]
        public void RemoveBook_Pending_RemovesIt()
        {
            var campaign = Campaign();
            var book = campaign.DeliverBook("tp-1", 12, 166, Delivered);

            campaign.RemoveBook(book.Id);

            Assert.Empty(campaign.Books);
        }

        [Fact]
        public void RemoveBook_Returned_Throws()
        {
            var campaign = Campaign();
            var book = campaign.DeliverBook("tp-1", 12, 166, Delivered);
            campaign.ReturnBook(book.Id, 75m, Delivered);

            var ex = Assert.Throws<DomainException>(() => campaign.RemoveBook(book.Id));
            Assert.Equal(ErrorCodes.LotteryBookAlreadyReturned, ex.Code);
        }

        [Fact]
        public void Update_PriceWithBooks_Throws()
        {
            var campaign = Campaign();
            campaign.DeliverBook("tp-1", 12, 166, Delivered);

            var ex = Assert.Throws<DomainException>(() =>
                campaign.Update("Navidad", DrawDate, 6m, 15, ClubFrom, ClubTo));
            Assert.Equal(ErrorCodes.LotteryCampaignHasBooks, ex.Code);
        }

        [Fact]
        public void Update_ClubWindowWithBooks_IsAllowed()
        {
            var campaign = Campaign();
            campaign.DeliverBook("tp-1", 12, 166, Delivered);

            campaign.Update("Lotería del Niño", new DateOnly(2027, 1, 6), 5m, 15,
                new DateOnly(2026, 12, 12), new DateOnly(2026, 12, 19));

            Assert.Equal("Lotería del Niño", campaign.Name);
            Assert.Equal(new DateOnly(2026, 12, 12), campaign.ClubDeliveryFrom);
            Assert.Equal(new DateOnly(2026, 12, 19), campaign.ClubDeliveryTo);
            Assert.Single(campaign.Books);
        }

        [Fact]
        public void EnsureCanBeDeleted_WithBooks_Throws()
        {
            var campaign = Campaign();
            campaign.DeliverBook("tp-1", 12, 166, Delivered);

            var ex = Assert.Throws<DomainException>(() => campaign.EnsureCanBeDeleted());
            Assert.Equal(ErrorCodes.LotteryCampaignHasBooks, ex.Code);
        }

        [Fact]
        public void RecordClubDelivery_StoresAmountAndDate_AndUndoClearsIt()
        {
            var campaign = Campaign();

            campaign.RecordClubDelivery(115m, new DateOnly(2026, 12, 10));
            Assert.Equal(115m, campaign.ClubDeliveredAmount);
            Assert.Equal(new DateOnly(2026, 12, 10), campaign.ClubDeliveredOn);

            campaign.UndoClubDelivery();
            Assert.Null(campaign.ClubDeliveredAmount);
            Assert.Null(campaign.ClubDeliveredOn);
        }

        [Fact]
        public void RecordClubDelivery_Negative_Throws()
        {
            var ex = Assert.Throws<DomainException>(() => Campaign().RecordClubDelivery(-1m, ClubFrom));
            Assert.Equal(ErrorCodes.LotteryInvalidClubDeliveryAmount, ex.Code);
        }
    }
}
