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

        private static LotteryBook Assigned(LotteryCampaign campaign, string player = "tp-1", int number = 12, int first = 166, int last = 180) =>
            campaign.AssignBook(null, player, number, first, last);

        private static LotteryBook DeliveredToPlayer(LotteryCampaign campaign)
        {
            var book = Assigned(campaign);
            campaign.AdvanceBook(book.Id, Delivered, null);
            return book;
        }

        private static LotteryBook Returned(LotteryCampaign campaign)
        {
            var book = DeliveredToPlayer(campaign);
            campaign.AdvanceBook(book.Id, Delivered.AddDays(10), 60m);
            return book;
        }

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
        public void CreateBooks_GeneratesConsecutiveUnassignedBooks()
        {
            var campaign = Campaign();

            var books = campaign.CreateBooks(3);

            Assert.Equal(new[] { 1, 2, 3 }, books.Select(b => b.BookNumber));
            Assert.Equal(new[] { 1, 16, 31 }, books.Select(b => b.FirstTicketNumber));
            Assert.Equal(new[] { 15, 30, 45 }, books.Select(b => b.LastTicketNumber));
            Assert.All(books, b => Assert.Equal(LotteryBookStatus.Unassigned, b.Status));
            Assert.All(books, b => Assert.Null(b.TeamPlayerId));
            Assert.Equal(3, campaign.Books.Count);
        }

        [Fact]
        public void CreateBooks_ContinuesAfterTheExistingBooks()
        {
            var campaign = Campaign();
            Assigned(campaign);

            var books = campaign.CreateBooks(2);

            Assert.Equal(new[] { 13, 14 }, books.Select(b => b.BookNumber));
            Assert.Equal(new[] { 181, 196 }, books.Select(b => b.FirstTicketNumber));
            Assert.Equal(new[] { 195, 210 }, books.Select(b => b.LastTicketNumber));
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-1)]
        [InlineData(201)]
        public void CreateBooks_WithInvalidCount_Throws(int count)
        {
            var ex = Assert.Throws<DomainException>(() => Campaign().CreateBooks(count));
            Assert.Equal(ErrorCodes.LotteryInvalidBookCount, ex.Code);
        }

        [Fact]
        public void AssignBook_NewBook_IsCreatedAssignedWithTheGivenRange()
        {
            var campaign = Campaign();

            var book = Assigned(campaign);

            Assert.Equal(LotteryBookStatus.Assigned, book.Status);
            Assert.Equal("tp-1", book.TeamPlayerId);
            Assert.Equal(12, book.BookNumber);
            Assert.Equal(166, book.FirstTicketNumber);
            Assert.Equal(180, book.LastTicketNumber);
            Assert.Null(book.DeliveredOn);
            Assert.Same(book, Assert.Single(campaign.Books));
        }

        [Fact]
        public void AssignBook_AllowsSeveralBooksPerPlayer()
        {
            var campaign = Campaign();
            Assigned(campaign, "tp-1", 1, 1, 15);
            Assigned(campaign, "tp-1", 2, 16, 30);

            Assert.Equal(2, campaign.Books.Count(b => b.TeamPlayerId == "tp-1"));
        }

        [Fact]
        public void AssignBook_AllowsBooksOfDifferentSizes()
        {
            var campaign = Campaign();
            var small = Assigned(campaign, "tp-1", 1, 1, 10);
            var big = Assigned(campaign, "tp-2", 2, 11, 40);

            Assert.Equal(10, small.TicketCount);
            Assert.Equal(30, big.TicketCount);
        }

        [Fact]
        public void AssignBook_ExistingUnassignedBook_SetsPlayerAndNumbers()
        {
            var campaign = Campaign();
            var book = campaign.CreateBooks(2)[0];

            var assigned = campaign.AssignBook(book.Id, "tp-1", 1, 1, 12);

            Assert.Same(book, assigned);
            Assert.Equal(LotteryBookStatus.Assigned, book.Status);
            Assert.Equal("tp-1", book.TeamPlayerId);
            Assert.Equal(12, book.LastTicketNumber);
            Assert.Equal(2, campaign.Books.Count);
        }

        [Fact]
        public void AssignBook_AlreadyAssigned_Throws()
        {
            var campaign = Campaign();
            var book = Assigned(campaign);

            var ex = Assert.Throws<DomainException>(() => campaign.AssignBook(book.Id, "tp-2", 12, 166, 180));
            Assert.Equal(ErrorCodes.LotteryBookNotUnassigned, ex.Code);
        }

        [Fact]
        public void AssignBook_UnknownBook_ThrowsNotFound()
        {
            var ex = Assert.Throws<NotFoundException>(() => Campaign().AssignBook("nope", "tp-1", 1, 1, 15));
            Assert.Equal(ErrorCodes.LotteryBookNotFound, ex.Code);
        }

        [Fact]
        public void AssignBook_WithLastTicketLowerThanFirst_Throws()
        {
            var ex = Assert.Throws<DomainException>(() => Campaign().AssignBook(null, "tp-1", 1, 20, 19));
            Assert.Equal(ErrorCodes.LotteryInvalidTicketRange, ex.Code);
        }

        [Fact]
        public void AssignBook_WithDuplicatedNumber_Throws()
        {
            var campaign = Campaign();
            Assigned(campaign);

            var ex = Assert.Throws<DomainException>(() => campaign.AssignBook(null, "tp-2", 12, 500, 514));
            Assert.Equal(ErrorCodes.LotteryBookNumberDuplicated, ex.Code);
        }

        [Theory]
        [InlineData(152, 166)]
        [InlineData(180, 190)]
        [InlineData(170, 175)]
        [InlineData(100, 300)]
        public void AssignBook_WithOverlappingRange_Throws(int first, int last)
        {
            var campaign = Campaign();
            Assigned(campaign);

            var ex = Assert.Throws<DomainException>(() => campaign.AssignBook(null, "tp-2", 13, first, last));
            Assert.Equal(ErrorCodes.LotteryTicketRangeOverlap, ex.Code);
        }

        [Fact]
        public void AssignBook_WithAdjacentRange_Succeeds()
        {
            var campaign = Campaign();
            Assigned(campaign);

            campaign.AssignBook(null, "tp-2", 11, 151, 165);
            campaign.AssignBook(null, "tp-3", 13, 181, 195);

            Assert.Equal(3, campaign.Books.Count);
        }

        [Fact]
        public void EditBook_WhileAssigned_ChangesTheThreeNumbers()
        {
            var campaign = Campaign();
            var book = Assigned(campaign);

            campaign.EditBook(book.Id, 20, 300, 320);

            Assert.Equal(20, book.BookNumber);
            Assert.Equal(300, book.FirstTicketNumber);
            Assert.Equal(320, book.LastTicketNumber);
        }

        [Fact]
        public void EditBook_KeepingItsOwnRange_DoesNotOverlapWithItself()
        {
            var campaign = Campaign();
            var book = Assigned(campaign);

            campaign.EditBook(book.Id, 12, 170, 185);

            Assert.Equal(170, book.FirstTicketNumber);
        }

        [Fact]
        public void EditBook_OverlappingAnotherBook_Throws()
        {
            var campaign = Campaign();
            Assigned(campaign);
            var other = Assigned(campaign, "tp-2", 13, 181, 195);

            var ex = Assert.Throws<DomainException>(() => campaign.EditBook(other.Id, 13, 175, 190));
            Assert.Equal(ErrorCodes.LotteryTicketRangeOverlap, ex.Code);
        }

        [Fact]
        public void EditBook_AfterDeliveryToThePlayer_Throws()
        {
            var campaign = Campaign();
            var book = DeliveredToPlayer(campaign);

            var ex = Assert.Throws<DomainException>(() => campaign.EditBook(book.Id, 20, 300, 320));
            Assert.Equal(ErrorCodes.LotteryBookNumbersLocked, ex.Code);
        }

        [Fact]
        public void EditBook_Unknown_ThrowsNotFound()
        {
            var ex = Assert.Throws<NotFoundException>(() => Campaign().EditBook("nope", 1, 1, 15));
            Assert.Equal(ErrorCodes.LotteryBookNotFound, ex.Code);
        }

        [Fact]
        public void AdvanceBook_MovesOneStepAtATime()
        {
            var campaign = Campaign();
            var book = Assigned(campaign);

            campaign.AdvanceBook(book.Id, Delivered, null);
            Assert.Equal(LotteryBookStatus.DeliveredToPlayer, book.Status);
            Assert.Equal(Delivered, book.DeliveredOn);

            campaign.AdvanceBook(book.Id, Delivered.AddDays(10), 60m);
            Assert.Equal(LotteryBookStatus.ReturnedToCoach, book.Status);
            Assert.Equal(Delivered.AddDays(10), book.ReturnedOn);
            Assert.Equal(60m, book.AmountReturned);

            campaign.AdvanceBook(book.Id, ClubFrom, null);
            Assert.Equal(LotteryBookStatus.DeliveredToClub, book.Status);
            Assert.Equal(ClubFrom, book.ClubDeliveredOn);
        }

        [Fact]
        public void AdvanceBook_UnassignedBook_CannotSkipTheAssignment()
        {
            var campaign = Campaign();
            var book = campaign.CreateBooks(1)[0];

            var ex = Assert.Throws<DomainException>(() => campaign.AdvanceBook(book.Id, Delivered, null));
            Assert.Equal(ErrorCodes.LotteryBookNotAssigned, ex.Code);
            Assert.Equal(LotteryBookStatus.Unassigned, book.Status);
        }

        [Fact]
        public void AdvanceBook_DeliveredToClub_HasNoNextStep()
        {
            var campaign = Campaign();
            var book = Returned(campaign);
            campaign.AdvanceBook(book.Id, ClubFrom, null);

            var ex = Assert.Throws<DomainException>(() => campaign.AdvanceBook(book.Id, ClubTo, null));
            Assert.Equal(ErrorCodes.LotteryBookNoNextStatus, ex.Code);
        }

        [Fact]
        public void AdvanceBook_Return_StoresAmountAndComputesSoldTickets()
        {
            var campaign = Campaign();
            var book = Returned(campaign);

            Assert.Equal(12, campaign.TicketsSold(book));
            Assert.Equal(3, campaign.TicketsUnsold(book));
        }

        [Theory]
        [InlineData(62)]
        [InlineData(80)]
        [InlineData(-5)]
        public void AdvanceBook_ReturnWithInvalidAmount_Throws(decimal amount)
        {
            var campaign = Campaign();
            var book = DeliveredToPlayer(campaign);

            var ex = Assert.Throws<DomainException>(() => campaign.AdvanceBook(book.Id, Delivered, amount));
            Assert.Equal(ErrorCodes.LotteryInvalidReturnAmount, ex.Code);
        }

        [Fact]
        public void AdvanceBook_ReturnWithoutAmount_Throws()
        {
            var campaign = Campaign();
            var book = DeliveredToPlayer(campaign);

            var ex = Assert.Throws<DomainException>(() => campaign.AdvanceBook(book.Id, Delivered, null));
            Assert.Equal(ErrorCodes.LotteryInvalidReturnAmount, ex.Code);
        }

        [Fact]
        public void AdvanceBook_ReturnAmountLimitFollowsTheSizeOfTheBook()
        {
            var campaign = Campaign();
            var book = Assigned(campaign, "tp-1", 1, 1, 10);
            campaign.AdvanceBook(book.Id, Delivered, null);

            var ex = Assert.Throws<DomainException>(() => campaign.AdvanceBook(book.Id, Delivered, 55m));
            Assert.Equal(ErrorCodes.LotteryInvalidReturnAmount, ex.Code);
            campaign.AdvanceBook(book.Id, Delivered, 50m);
            Assert.Equal(10, campaign.TicketsSold(book));
            Assert.Equal(0, campaign.TicketsUnsold(book));
        }

        [Fact]
        public void AdvanceBook_ReturnWithZero_MeansNothingSold()
        {
            var campaign = Campaign();
            var book = DeliveredToPlayer(campaign);

            campaign.AdvanceBook(book.Id, Delivered, 0m);

            Assert.Equal(LotteryBookStatus.ReturnedToCoach, book.Status);
            Assert.Equal(0, campaign.TicketsSold(book));
            Assert.Equal(15, campaign.TicketsUnsold(book));
        }

        [Fact]
        public void AdvanceBook_ReturnBeforeDelivery_Throws()
        {
            var campaign = Campaign();
            var book = DeliveredToPlayer(campaign);

            var ex = Assert.Throws<DomainException>(() => campaign.AdvanceBook(book.Id, Delivered.AddDays(-1), 75m));
            Assert.Equal(ErrorCodes.LotteryReturnBeforeDelivery, ex.Code);
        }

        [Fact]
        public void TicketsSold_BeforeTheReturn_IsUnknown()
        {
            var campaign = Campaign();
            var book = DeliveredToPlayer(campaign);

            Assert.Null(campaign.TicketsSold(book));
            Assert.Null(campaign.TicketsUnsold(book));
        }

        [Fact]
        public void UndoBookStatus_Assigned_RemovesOnlyThePlayer()
        {
            var campaign = Campaign();
            var book = Assigned(campaign);

            campaign.UndoBookStatus(book.Id);

            Assert.Equal(LotteryBookStatus.Unassigned, book.Status);
            Assert.Null(book.TeamPlayerId);
            Assert.Equal(12, book.BookNumber);
            Assert.Equal(166, book.FirstTicketNumber);
            Assert.Equal(180, book.LastTicketNumber);
        }

        [Fact]
        public void UndoBookStatus_DeliveredToPlayer_RemovesOnlyTheDeliveryDate()
        {
            var campaign = Campaign();
            var book = DeliveredToPlayer(campaign);

            campaign.UndoBookStatus(book.Id);

            Assert.Equal(LotteryBookStatus.Assigned, book.Status);
            Assert.Null(book.DeliveredOn);
            Assert.Equal("tp-1", book.TeamPlayerId);
        }

        [Fact]
        public void UndoBookStatus_Returned_RemovesOnlyTheReturnDateAndAmount()
        {
            var campaign = Campaign();
            var book = Returned(campaign);

            campaign.UndoBookStatus(book.Id);

            Assert.Equal(LotteryBookStatus.DeliveredToPlayer, book.Status);
            Assert.Null(book.ReturnedOn);
            Assert.Null(book.AmountReturned);
            Assert.Equal(Delivered, book.DeliveredOn);
        }

        [Fact]
        public void UndoBookStatus_DeliveredToClub_RemovesOnlyTheClubDeliveryDate()
        {
            var campaign = Campaign();
            var book = Returned(campaign);
            campaign.AdvanceBook(book.Id, ClubFrom, null);

            campaign.UndoBookStatus(book.Id);

            Assert.Equal(LotteryBookStatus.ReturnedToCoach, book.Status);
            Assert.Null(book.ClubDeliveredOn);
            Assert.Equal(60m, book.AmountReturned);
            Assert.Equal(Delivered.AddDays(10), book.ReturnedOn);
        }

        [Fact]
        public void UndoBookStatus_Unassigned_HasNothingToUndo()
        {
            var campaign = Campaign();
            var book = campaign.CreateBooks(1)[0];

            var ex = Assert.Throws<DomainException>(() => campaign.UndoBookStatus(book.Id));
            Assert.Equal(ErrorCodes.LotteryBookNothingToUndo, ex.Code);
        }

        [Fact]
        public void RemoveBook_Unassigned_RemovesIt()
        {
            var campaign = Campaign();
            var book = campaign.CreateBooks(1)[0];

            campaign.RemoveBook(book.Id);

            Assert.Empty(campaign.Books);
        }

        [Fact]
        public void RemoveBook_Assigned_Throws()
        {
            var campaign = Campaign();
            var book = Assigned(campaign);

            var ex = Assert.Throws<DomainException>(() => campaign.RemoveBook(book.Id));
            Assert.Equal(ErrorCodes.LotteryBookNotUnassigned, ex.Code);
        }

        [Fact]
        public void Update_PriceWithBooks_Throws()
        {
            var campaign = Campaign();
            Assigned(campaign);

            var ex = Assert.Throws<DomainException>(() =>
                campaign.Update("Navidad", DrawDate, 6m, 15, ClubFrom, ClubTo));
            Assert.Equal(ErrorCodes.LotteryCampaignHasBooks, ex.Code);
        }

        [Fact]
        public void Update_TicketsPerBookWithBooks_IsAllowedAndKeepsTheBooks()
        {
            var campaign = Campaign();
            var book = Assigned(campaign);

            campaign.Update("Navidad", DrawDate, 5m, 20, ClubFrom, ClubTo);

            Assert.Equal(20, campaign.TicketsPerBook);
            Assert.Equal(180, book.LastTicketNumber);
        }

        [Fact]
        public void Update_ClubWindowWithBooks_IsAllowed()
        {
            var campaign = Campaign();
            Assigned(campaign);

            campaign.Update("Lotería del Niño", new DateOnly(2027, 1, 6), 5m, 15,
                new DateOnly(2026, 12, 12), new DateOnly(2026, 12, 19));

            Assert.Equal("Lotería del Niño", campaign.Name);
            Assert.Equal(new DateOnly(2026, 12, 12), campaign.ClubDeliveryFrom);
            Assert.Equal(new DateOnly(2026, 12, 19), campaign.ClubDeliveryTo);
            Assert.Single(campaign.Books);
        }

        [Fact]
        public void EnsureCanBeDeleted_WithAssignedBooks_Throws()
        {
            var campaign = Campaign();
            Assigned(campaign);

            var ex = Assert.Throws<DomainException>(() => campaign.EnsureCanBeDeleted());
            Assert.Equal(ErrorCodes.LotteryCampaignHasBooks, ex.Code);
        }

        [Fact]
        public void EnsureCanBeDeleted_WithOnlyUnassignedBooks_Succeeds()
        {
            var campaign = Campaign();
            campaign.CreateBooks(3);

            campaign.EnsureCanBeDeleted();
        }
    }
}
