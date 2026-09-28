using Ardalis.SmartEnum;

namespace RFFM.Api.Domain.Entities.Federation.SquadHistory
{
    public sealed class SquadHistoryStatus : SmartEnum<SquadHistoryStatus>
    {
        public static readonly SquadHistoryStatus Pending = new(nameof(Pending), 1);
        public static readonly SquadHistoryStatus Running = new(nameof(Running), 2);
        public static readonly SquadHistoryStatus Completed = new(nameof(Completed), 3);
        public static readonly SquadHistoryStatus Failed = new(nameof(Failed), 4);

        private SquadHistoryStatus(string name, int value) : base(name, value)
        {
        }
    }

    public sealed class SquadHistorySource : SmartEnum<SquadHistorySource>
    {
        public static readonly SquadHistorySource PlayerSheet = new(nameof(PlayerSheet), 1);
        public static readonly SquadHistorySource Actas = new(nameof(Actas), 2);

        private SquadHistorySource(string name, int value) : base(name, value)
        {
        }
    }
}
