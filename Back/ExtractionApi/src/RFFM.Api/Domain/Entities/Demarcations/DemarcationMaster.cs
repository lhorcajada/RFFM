namespace RFFM.Api.Domain.Entities.Demarcations
{
    public class DemarcationMaster
    {
        public string Name { get; }
        public string Code { get; }
        public int Id { get; }

        private static readonly Dictionary<int, DemarcationMaster> Demarcations = new Dictionary<int, DemarcationMaster>();

        public DemarcationMaster(){}

        private DemarcationMaster(int id, string name, string code)
        {
            Id = id;
            Name = name;
            Demarcations[id] = this;
            Code = code;
        }

        public static DemarcationMaster GetById(int id)
        {
            return Demarcations.GetValueOrDefault(id)!;
        }
        public static IEnumerable<DemarcationMaster> List()
        {
            return Demarcations.Values;
        }

        public override string ToString()
        {
            return Name;
        }

        public static readonly DemarcationMaster GoalKeeper = new (1, "Portero", "POR");
        public static readonly DemarcationMaster LeftBack = new (2, "Lateral Izquierdo", "LI");
        public static readonly DemarcationMaster RightBack = new (3, "Lateral Derecho", "LD");
        public static readonly DemarcationMaster CenterBack = new (4, "Defensa Central", "DFC");
        public static readonly DemarcationMaster Sweeper = new (5, "Líbero", "LIB");
        public static readonly DemarcationMaster CentralMidfielder = new (6, "Medio Centro", "MC");
        public static readonly DemarcationMaster DefensiveMidfielder = new (7, "Medio Centro Defensivo", "MCD");
        public static readonly DemarcationMaster AttackingMidfielder = new (8, "Mediocampista ofensivo", "MCO");
        public static readonly DemarcationMaster LeftMidfielder = new(9, "Mediocampista Izquierdo", "MI");
        public static readonly DemarcationMaster RightMidfielder = new(10, "Mediocampista Derecho", "MD");
        public static readonly DemarcationMaster Striker = new(11, "Delantero Centro", "DC");
        public static readonly DemarcationMaster CenterForward = new(12, "Segundo Delantero", "SD");
        public static readonly DemarcationMaster LeftWinger = new(13, "Extremo Izquierdo", "EI");
        public static readonly DemarcationMaster RightWinger = new(14, "Extremo Derecho", "ED");
    }
}
