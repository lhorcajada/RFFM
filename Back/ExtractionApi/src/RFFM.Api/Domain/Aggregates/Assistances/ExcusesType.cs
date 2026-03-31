namespace RFFM.Api.Domain.Aggregates.Assistances
{
    public class ExcuseTypes
    {
        private static readonly ExcuseTypes Injury = new ExcuseTypes(1, "Lesión", true);
        private static readonly ExcuseTypes Study = new ExcuseTypes(2, "Estudios", true);
        private static readonly ExcuseTypes Ill = new ExcuseTypes(3, "Enfermedad", true);
        private static readonly ExcuseTypes FamilyProblem = new ExcuseTypes(4, "Problema familiar", true);
        private static readonly ExcuseTypes FamilyEvent = new ExcuseTypes(5, "Evento familiar", false);
        private static readonly ExcuseTypes BirthdayEvent = new ExcuseTypes(6, "Cumpleaños", false);

        public int Id { get; private set; }
        public string Name { get; private set; } = null!;
        public bool Justified { get; private set; }

        private ExcuseTypes() { }

        public ExcuseTypes(int id, string name, bool justified)
        {
            Id = id;
            Name = name;
            Justified = justified;
        }

        public static IEnumerable<ExcuseTypes> List() => new[] { Injury, Study, Ill, FamilyProblem, FamilyEvent, BirthdayEvent };

        public static ExcuseTypes? FromId(int id) => List().SingleOrDefault(e => e.Id == id);
    }
}
