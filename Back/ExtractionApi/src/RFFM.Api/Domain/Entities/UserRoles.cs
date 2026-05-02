
namespace RFFM.Api.Domain.Entities
{
    public class UserRoles
    {
        public static UserRoles Coach = new UserRoles(1, "Coach");
        public static UserRoles Federation = new UserRoles(2, "Federation");
        public static UserRoles Administrator = new UserRoles(3, "Administrator");
        public static UserRoles User = new UserRoles(4, "User");
        public static UserRoles ClubDirector = new UserRoles(5, "ClubDirector");
        public static UserRoles Player = new UserRoles(6, "Player");
        public static UserRoles FamilyMember = new UserRoles(7, "FamilyMember");
        public static UserRoles Fan = new UserRoles(8, "Fan");
        public static UserRoles ClubMember = new UserRoles(9, "ClubMember");

        public int Id { get; private set; }
        public string Name { get; private set; }
        private UserRoles(int id, string name)
        {
            Id = id;
            Name = name;
        }

        public static IEnumerable<UserRoles> List() => new[]
        {
            Coach, Federation, Administrator, User, ClubDirector, Player, FamilyMember, Fan, ClubMember
        };

        public static UserRoles FromName(string name)
        {
            var role = List()
                .SingleOrDefault(r => string.Equals(r.Name, name, StringComparison.CurrentCultureIgnoreCase));
            if (role == null)
            {
                throw new Exception($"Possible values for UserRoles: {string.Join(",", List().Select(r => r.Name))}");
            }
            return role;
        }
        public static UserRoles From(int id)
        {
            var role = List()
                .SingleOrDefault(r => r.Id == id);
            if (role == null)
            {
                throw new Exception($"Possible values for UserRoles: {string.Join(",", List().Select(r => r.Name))}");
            }
            return role;
        }
    }
}
