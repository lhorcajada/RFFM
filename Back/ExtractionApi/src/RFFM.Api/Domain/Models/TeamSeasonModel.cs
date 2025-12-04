namespace RFFM.Api.Domain.Models
{
    public class TeamSeasonModel
    {
        public string ClubId { get; set; } = string.Empty;
        public int CategoryId { get; set; }
        public string TeamName { get; set; } = string.Empty;
        public string SeasonId { get; set; } = string.Empty;

    }
}
