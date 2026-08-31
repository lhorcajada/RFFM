namespace RFFM.Api.Domain.ValueObjects
{
    public class FamilyMember
    {
        public static readonly FamilyMember Mother = new FamilyMember(1, "Mother");

        public static readonly FamilyMember Father = new FamilyMember(2, "Father");

        public static readonly FamilyMember LegalGuardian = new FamilyMember(3, "LegalGuardian");

        public static readonly FamilyMember Other = new FamilyMember(4, "Other");

        public int Id { get; }
        public string Name { get; }

        private FamilyMember(int id, string name)
        {
            Id = id;
            Name = name;
        }

        public static IEnumerable<FamilyMember> List() =>
            new[] { Mother, Father, LegalGuardian, Other };

        public static FamilyMember? FromId(int id)
        {
            return List().FirstOrDefault(x => x.Id == id);
        }
    }
}
