namespace RFFM.Api.Domain.Entities
{
    public class UserRoles
    {
        public static UserRoles Administrator = new UserRoles(1, "Administrador");
        public static UserRoles User = new UserRoles(2, "Usuario");

        public int Id { get; private set; }
        public string Name { get; private set; }
        private UserRoles(int id, string name)
        {
            Id = id;
            Name = name;
        }

        public static IEnumerable<UserRoles> List() => new[] { Administrator, User };

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
