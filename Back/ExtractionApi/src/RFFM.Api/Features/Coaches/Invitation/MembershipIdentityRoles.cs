using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;

namespace RFFM.Api.Features.Coaches.Invitation
{
    public static class MembershipIdentityRoles
    {
        public static string? ToIdentityRoleName(Membership? membership)
        {
            if (membership is null) return null;
            return membership.Key switch
            {
                "Directive" => AppRoles.ClubDirector.Name,
                "Coach" => AppRoles.Coach.Name,
                "ClubMember" => AppRoles.ClubMember.Name,
                "Player" => AppRoles.Player.Name,
                "FamilyPlayer" => AppRoles.FamilyMember.Name,
                "Follower" => AppRoles.Fan.Name,
                _ => null
            };
        }

        public static Membership? FromKey(string? key)
        {
            if (string.IsNullOrWhiteSpace(key)) return null;
            return Membership.GetAll().FirstOrDefault(m => m.Key == key);
        }
    }
}