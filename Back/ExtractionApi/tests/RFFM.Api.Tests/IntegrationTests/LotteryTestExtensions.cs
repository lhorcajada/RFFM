#nullable enable
using System;
using RFFM.Api.Domain.Entities.Teams;

namespace RFFM.Api.Tests.IntegrationTests
{
    internal static class LotteryTestExtensions
    {
        /// <summary>Crea un taco con el tamaño de la campaña, lo asigna y se lo entrega al jugador.</summary>
        public static LotteryBook DeliverBook(this LotteryCampaign campaign, string teamPlayerId, int bookNumber, int firstTicketNumber, DateOnly deliveredOn)
        {
            var book = campaign.AssignBook(null, teamPlayerId, bookNumber, firstTicketNumber, firstTicketNumber + campaign.TicketsPerBook - 1);
            campaign.AdvanceBook(book.Id, deliveredOn, null);
            return book;
        }

        public static void ReturnBook(this LotteryCampaign campaign, string bookId, decimal amount, DateOnly returnedOn) =>
            campaign.AdvanceBook(bookId, returnedOn, amount);
    }
}
