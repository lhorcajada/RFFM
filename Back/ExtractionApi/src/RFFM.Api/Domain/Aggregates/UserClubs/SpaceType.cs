using Ardalis.SmartEnum;

namespace RFFM.Api.Domain.Aggregates.UserClubs
{
    public sealed class SpaceType : SmartEnum<SpaceType>
    {
        public static readonly SpaceType PersonalSpace = new(nameof(PersonalSpace), 1, "Espacio personal");
        public static readonly SpaceType Club = new(nameof(Club), 2, "Club");

        public string Label { get; }

        private SpaceType(string name, int value, string label) : base(name, value)
        {
            Label = label;
        }
    }
}
