namespace RFFM.Api.Domain.Entities.Coaches
{
    public class ConfigurationCoach
    {
        public int Id { get; set; }
        public string CoachId { get; set; } = null!; // identity user id
        public string? PreferredClubId { get; set; }
        public string? PreferredTeamId { get; set; }
    }
}
