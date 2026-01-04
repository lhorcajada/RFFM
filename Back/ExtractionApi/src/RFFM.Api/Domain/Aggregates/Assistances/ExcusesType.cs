namespace RFFM.Api.Domain.Aggregates.Assistances
{
    public class ExcuseTypes
    {
        private static readonly ExcuseTypes Injury = new ExcuseTypes(1, "Injury", true);
        private static readonly ExcuseTypes Study = new ExcuseTypes(2, "Study", true);
        private static readonly ExcuseTypes Ill = new ExcuseTypes(3, "Ill", true);
        private static readonly ExcuseTypes FamilyProblem = new ExcuseTypes(4, "Family Problem", true);
        private static readonly ExcuseTypes FamilyEvent = new ExcuseTypes(5, "Family Event", false);
        private static readonly ExcuseTypes BirthdayEvent = new ExcuseTypes(6, "Birthday Event", false);

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
