namespace RFFM.Api.Domain.Entities
{
    /// <summary>
    /// Type-safe enum for application roles.
    /// Use the `Name` property when interacting with Identity role names.
    /// </summary>
    public sealed class AppRoles
    {
        public int Id { get; }
        public string Name { get; }

        private AppRoles(int id, string name)
        {
            Id = id;
            Name = name;
        }

        public static readonly AppRoles Administrator = new AppRoles(1, "Administrator");
        public static readonly AppRoles Federation = new AppRoles(2, "Federation");
        public static readonly AppRoles Coach = new AppRoles(3, "Coach");
        public static readonly AppRoles ClubDirector = new AppRoles(4, "ClubDirector");
        public static readonly AppRoles Player = new AppRoles(5, "Player");
        public static readonly AppRoles FamilyMember = new AppRoles(6, "FamilyMember");
        public static readonly AppRoles Fan = new AppRoles(7, "Fan");
        public static readonly AppRoles ClubMember = new AppRoles(8, "ClubMember");

        public static IEnumerable<AppRoles> List() => new[]
        {
            Administrator, Federation, Coach, ClubDirector, Player, FamilyMember, Fan, ClubMember
        };

        public static AppRoles FromName(string name)
        {
            var role = List().SingleOrDefault(r => string.Equals(r.Name, name, StringComparison.OrdinalIgnoreCase));
            return role ?? throw new ArgumentException($@"Unknown role name: {name}", nameof(name));
        }

        public static AppRoles FromId(int id)
        {
            var role = List().SingleOrDefault(r => r.Id == id);
            return role ?? throw new ArgumentException($@"Unknown role id: {id}", nameof(id));
        }

        public override string ToString() => Name;

        public static implicit operator string(AppRoles r) => r.Name;
    }
}