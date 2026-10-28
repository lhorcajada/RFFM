using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Teams;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class QuinielaTicketTests
    {
        private static readonly DateTime Deadline = new(2026, 10, 30, 23, 0, 0, DateTimeKind.Utc);
        private static readonly DateTime Now = new(2026, 10, 28, 10, 0, 0, DateTimeKind.Utc);

        private static QuinielaPick[] Picks() =>
        [
            new("A", QuinielaSign.Home),
            new("B", QuinielaSign.Draw)
        ];

        private static QuinielaTicket NewTicket() => QuinielaTicket.Create("j1", "u1", Picks(), 1, 3);

        [Fact]
        public void Create_StartsPendingWithPicksAndPleno()
        {
            var ticket = NewTicket();

            Assert.Equal(QuinielaPaymentStatus.Pending, ticket.PaymentStatus);
            Assert.Equal(2, ticket.Picks.Count);
            Assert.Equal(1, ticket.PlenoHome);
            Assert.Equal(3, ticket.PlenoAway);
        }

        [Theory]
        [InlineData("", "u1")]
        [InlineData("j1", "")]
        public void Create_WithoutIds_Throws(string jornadaId, string userId) =>
            Assert.Throws<ArgumentException>(() => QuinielaTicket.Create(jornadaId, userId, Picks(), 0, 0));

        [Theory]
        [InlineData(-1, 0)]
        [InlineData(0, 4)]
        public void Create_WithPlenoOutOfRange_Throws(int home, int away)
        {
            var ex = Assert.Throws<DomainException>(() => QuinielaTicket.Create("j1", "u1", Picks(), home, away));

            Assert.Equal(ErrorCodes.QuinielaInvalidTicket, ex.Code);
        }

        [Fact]
        public void Create_WithoutPicks_Throws() =>
            Assert.Throws<DomainException>(() => QuinielaTicket.Create("j1", "u1", [], 0, 0));

        [Fact]
        public void Create_WithDuplicatedMatch_Throws() =>
            Assert.Throws<DomainException>(() => QuinielaTicket.Create("j1", "u1",
                [new QuinielaPick("A", QuinielaSign.Home), new QuinielaPick("A", QuinielaSign.Away)], 0, 0));

        [Fact]
        public void ReplacePicks_ReplacesPicksAndKeepsPaymentStatus()
        {
            var ticket = NewTicket();
            ticket.MarkPaid(QuinielaPaymentMethod.Cash, Now);

            ticket.ReplacePicks([new QuinielaPick("C", QuinielaSign.Away)], 2, 2);

            Assert.Single(ticket.Picks);
            Assert.Equal("C", ticket.Picks.Single().RecordCode);
            Assert.Equal(2, ticket.PlenoHome);
            Assert.Equal(QuinielaPaymentStatus.Paid, ticket.PaymentStatus);
        }

        [Fact]
        public void MarkPaid_StoresDateAndMethod()
        {
            var ticket = NewTicket();

            ticket.MarkPaid(QuinielaPaymentMethod.Bizum, Now);

            Assert.Equal(QuinielaPaymentStatus.Paid, ticket.PaymentStatus);
            Assert.Equal(Now, ticket.PaidAt);
            Assert.Equal(QuinielaPaymentMethod.Bizum, ticket.PaymentMethod);
        }

        [Fact]
        public void MarkPending_ClearsPaymentData()
        {
            var ticket = NewTicket();
            ticket.MarkPaid(QuinielaPaymentMethod.Cash, Now);

            ticket.MarkPending();

            Assert.Equal(QuinielaPaymentStatus.Pending, ticket.PaymentStatus);
            Assert.Null(ticket.PaidAt);
            Assert.Null(ticket.PaymentMethod);
        }

        [Fact]
        public void EffectiveStatus_PendingBeforeDeadline_IsPending() =>
            Assert.Equal(QuinielaPaymentStatus.Pending, NewTicket().EffectiveStatus(Deadline, Deadline.AddMinutes(-1)));

        [Fact]
        public void EffectiveStatus_PendingAtDeadline_IsExpired() =>
            Assert.Equal(QuinielaPaymentStatus.Expired, NewTicket().EffectiveStatus(Deadline, Deadline));

        [Fact]
        public void EffectiveStatus_PaidAfterDeadline_StaysPaid()
        {
            var ticket = NewTicket();
            ticket.MarkPaid(QuinielaPaymentMethod.Cash, Now);

            Assert.Equal(QuinielaPaymentStatus.Paid, ticket.EffectiveStatus(Deadline, Deadline.AddDays(2)));
        }
    }
}
