using Ardalis.SmartEnum;

namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    public sealed class ObservationKind : SmartEnum<ObservationKind>
    {
        public static readonly ObservationKind GameModel = new(nameof(GameModel), 1);
        public static readonly ObservationKind Attitude = new(nameof(Attitude), 2);

        private ObservationKind(string name, int value) : base(name, value)
        {
        }
    }
}
