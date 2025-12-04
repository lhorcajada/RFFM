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

        public Membership(){}
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

        public static readonly Membership Directive = new Membership(1, CodeMessages.RoleDirective.Message, "Directive");
        public static readonly Membership Coach = new Membership(2, CodeMessages.RoleCoach.Message, "Coach");
        public static readonly Membership ClubMember = new Membership(3, CodeMessages.RoleClubMember.Message, "ClubMember");
        public static readonly Membership Player = new Membership(4, CodeMessages.RolePlayer.Message, "Player");
        public static readonly Membership FamilyPlayer = new Membership(5, CodeMessages.RoleFamilyPlayer.Message, "FamilyPlayer");
        public static readonly Membership Follower = new Membership(6, CodeMessages.RoleFollower.Message, "Follower");
 
    }
}
