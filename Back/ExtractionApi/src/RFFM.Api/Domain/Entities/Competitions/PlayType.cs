namespace RFFM.Api.Domain.Entities.Competitions
{
    public class PlayType
    {
        public string Name { get; }
        public int Id { get; }

        private static readonly Dictionary<int, PlayType> PlayTypes = new Dictionary<int, PlayType>();

        private PlayType(int id, string name)
        {
            Id = id;
            Name = name;
            PlayTypes[id] = this;
        }

        public static PlayType GetById(int id)
        {
            return PlayTypes.GetValueOrDefault(id)!;
        }

        public static IEnumerable<PlayType> GetAll()
        {
            return PlayTypes.Values;
        }

        public override string ToString()
        {
            return Name;
        }

        public static readonly PlayType F11 = new PlayType(1, "Fútbol 11");
        public static readonly PlayType F7 = new PlayType(2, "Fútbol 7");
        public static readonly PlayType FIndoor = new PlayType(3, "Fútbol Sala");
        public static readonly PlayType F5 = new PlayType(4, "Fútbol-5");
        public static readonly PlayType FPlaya = new PlayType(5, "Fútbol-Playa");

    }
}
