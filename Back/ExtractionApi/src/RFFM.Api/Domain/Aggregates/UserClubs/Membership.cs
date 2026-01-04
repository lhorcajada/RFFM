using RFFM.Api.Domain.Resources;

namespace RFFM.Api.Domain.Aggregates.UserClubs
{
    public class Membership
    {
        public string Name { get; }
        public int Id { get; private set; }
        public string Key { get; }
        public List<UserClub> UserClubs { get; set; }
        private static readonly Dictionary<int, Membership> Roles = new Dictionary<int, Membership>();

        public Membership() { }
        private Membership(int id, string name, string key)
        {
            Id = id;
            Name = name;
            Roles[id] = this;
            Key = key;
        }

        public static Membership GetById(int id)
        {
            return Roles.GetValueOrDefault(id)!;
        }
        public static IEnumerable<Membership> GetAll()
        {
            return Roles.Values;
        }

        public override string ToString()
        {
            return Name;
        }

        // Use fallback literal names here to avoid resolving localized resources at type initialization time
        public static readonly Membership Directive = new Membership(1, "Directive", "Directive");
        public static readonly Membership Coach = new Membership(2, "Coach", "Coach");
        public static readonly Membership ClubMember = new Membership(3, "Club member", "ClubMember");
        public static readonly Membership Player = new Membership(4, "Player", "Player");
        public static readonly Membership FamilyPlayer = new Membership(5, "FamilyMembers player", "FamilyPlayer");
        public static readonly Membership Follower = new Membership(6, "Follower", "Follower");
    }
}
