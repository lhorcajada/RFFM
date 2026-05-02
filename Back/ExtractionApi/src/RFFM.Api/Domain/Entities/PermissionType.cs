namespace RFFM.Api.Domain.Entities
{
    /// <summary>
    /// Type of permission for a feature or page element.
    /// </summary>
    public sealed class PermissionType
    {
        public int Id { get; }
        public string Name { get; }

        private PermissionType(int id, string name)
        {
            Id = id;
            Name = name;
        }

        public static readonly PermissionType Read = new PermissionType(1, "Read");
        public static readonly PermissionType Write = new PermissionType(2, "Write");
        public static readonly PermissionType ReadWrite = new PermissionType(3, "ReadWrite");

        public static IEnumerable<PermissionType> List() => new[] { Read, Write, ReadWrite };

        public static PermissionType FromId(int id)
        {
            var item = List().SingleOrDefault(p => p.Id == id);
            return item ?? throw new ArgumentException($"Unknown PermissionType id: {id}", nameof(id));
        }

        public static PermissionType FromName(string name)
        {
            var item = List().SingleOrDefault(p => string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase));
            return item ?? throw new ArgumentException($"Unknown PermissionType name: {name}", nameof(name));
        }

        public override string ToString() => Name;

        public static implicit operator string(PermissionType p) => p.Name;
    }
}
