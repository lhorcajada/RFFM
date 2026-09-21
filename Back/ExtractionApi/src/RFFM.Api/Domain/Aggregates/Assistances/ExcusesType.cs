namespace RFFM.Api.Domain.Aggregates.Assistances
{
    public class ExcuseTypes
    {
        private static readonly ExcuseTypes Injury = new ExcuseTypes(1, "Lesión", true);
        private static readonly ExcuseTypes Study = new ExcuseTypes(2, "Estudios", true);
        private static readonly ExcuseTypes Ill = new ExcuseTypes(3, "Enfermedad", true);
        private static readonly ExcuseTypes FamilyProblem = new ExcuseTypes(4, "Problema familiar", true);
        public static readonly ExcuseTypes FamilyEvent = new ExcuseTypes(5, "Evento familiar", false);
        private static readonly ExcuseTypes BirthdayEvent = new ExcuseTypes(6, "Cumpleaños", false);
        public static readonly ExcuseTypes TechnicalDecision = new ExcuseTypes(7, "Decisión técnica", false);
        public static readonly ExcuseTypes SportiveSanction = new ExcuseTypes(8, "Sanción deportiva", true);
        private static readonly ExcuseTypes MedicalAppointment = new ExcuseTypes(9, "Cita médica", true);

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

        public static IEnumerable<ExcuseTypes> List() => new[] { Injury, Study, Ill, FamilyProblem, FamilyEvent, BirthdayEvent, TechnicalDecision, SportiveSanction, MedicalAppointment };

        public static ExcuseTypes? FromId(int id) => List().SingleOrDefault(e => e.Id == id);
    }
}
