namespace RFFM.Api.Domain.Entities.PlayerFeet
{
    public class PlayerFeet 
    {
        public string Name { get; }
        public int Id { get; }

        private static readonly Dictionary<int, PlayerFeet> PlayerFeetList = new Dictionary<int,PlayerFeet>();

        public PlayerFeet(int id, string name)
        {
            Id = id;
            Name = name;
        }

        public static PlayerFeet GetById(int id)
        {
            return PlayerFeetList.GetValueOrDefault(id)!;
        }
        public static IEnumerable<PlayerFeet> GetAll()
        {
            return PlayerFeetList.Values;
        }

        public override string ToString()
        {
            return Name;
        }

        public static readonly PlayerFeet Left = new (1, "Zurdo");
        public static readonly PlayerFeet Right = new (2, "Diestro");
        public static readonly PlayerFeet Both = new (3, "Ambidiestro");

    }
}
