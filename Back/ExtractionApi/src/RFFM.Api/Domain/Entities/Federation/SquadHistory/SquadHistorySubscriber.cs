namespace RFFM.Api.Domain.Entities.Federation.SquadHistory
{
    public class SquadHistorySubscriber : BaseEntity
    {
        public string ReportId { get; private set; } = null!;
        public string UserId { get; private set; } = null!;
        public bool Notified { get; private set; }

        private SquadHistorySubscriber() { }

        internal static SquadHistorySubscriber Create(string userId) => new() { UserId = userId };

        internal void AwaitNotification() => Notified = false;

        internal void MarkNotified() => Notified = true;
    }
}
