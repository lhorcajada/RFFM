namespace RFFM.Api.Domain.ValueObjects
{
    public class FamilyMember
    {
        public static readonly FamilyMember Mother = new FamilyMember(1, "Mother");

        public static readonly FamilyMember Father = new FamilyMember(2, "Father");

        public int Id { get; }
        public string Name { get; }

        private FamilyMember(int id, string name)
        {
            Id = id;
            Name = name;
        }

        public static IEnumerable<FamilyMember> List() =>
            new[] { Mother, Father };

        public static FamilyMember? FromId(int id)
        {
            return List().FirstOrDefault(x => x.Id == id);
        }
    }
}
