namespace RFFM.Api.Common
{
    /// <summary>
    /// Marker interface for requests/queries that require the caller to belong to a specific team.
    /// Enforced only for Player/FamilyMember roles by TeamMembershipBehavior.
    /// </summary>
    public interface IRequireTeamMembership
    {
        string TeamId { get; }
    }
}
