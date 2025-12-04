namespace RFFM.Api.Domain.Aggregates.Assistances
{
    public class ExcuseTypes
    {
        private static readonly ExcuseTypes Injury = new ExcuseTypes(1, "Injury");
        private static readonly ExcuseTypes Study = new ExcuseTypes(2, "Study");
        private static readonly ExcuseTypes Ill = new ExcuseTypes(3, "Ill");

        public int Id { get; private set; }
        public string Name { get; private set; } = null!;

        private ExcuseTypes() { }

        public ExcuseTypes(int id, string name)
        {
            Id = id;
            Name = name;
        }

        public static IEnumerable<ExcuseTypes> List() => new[] { Injury, Study, Ill };

        public static ExcuseTypes? FromId(int id) => List().SingleOrDefault(e => e.Id == id);
    }
}
