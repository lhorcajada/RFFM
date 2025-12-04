namespace RFFM.Api.Domain.Aggregates.Technicals
{
    public class TechnicalType
    {
        public string Name { get; }
        public int Id { get; }

        private static readonly Dictionary<int, TechnicalType> TechnicalTypes = new Dictionary<int, TechnicalType>();

        private TechnicalType(int id, string name)
        {
            Id = id;
            Name = name;
            TechnicalTypes[id] = this;
        }

        public static TechnicalType GetById(int id)
        {
            return TechnicalTypes.GetValueOrDefault(id)!;
        }

        public override string ToString()
        {
            return Name;
        }

        internal static IEnumerable<TechnicalType> GetAll()
        {
            return TechnicalTypes.Values;
        }

        public static readonly TechnicalType Delegate = new TechnicalType(1, "Delegado");
        public static readonly TechnicalType FieldDelegate = new TechnicalType(2, "Delegado de campo");
        public static readonly TechnicalType Assistant = new TechnicalType(3, "Auxiliar");
        public static readonly TechnicalType HeadCoach = new TechnicalType(4, "Entrenador");
        public static readonly TechnicalType SecondCoach = new TechnicalType(5, "Segundo Entrenador");
        public static readonly TechnicalType GoalkeeperCoach = new TechnicalType(6, "Entrenador de porteros");
        public static readonly TechnicalType PhysicalTrainer = new TechnicalType(7, "Preparador físico");
        public static readonly TechnicalType Doctor = new TechnicalType(8, "Médico");
        public static readonly TechnicalType Psychologist = new TechnicalType(9, "Psicólogo");
        public static readonly TechnicalType TacticalAnalyst = new TechnicalType(10, "Analista táctico");
        public static readonly TechnicalType Nutritionist = new TechnicalType(11, "Nutricionista");
    }
}
