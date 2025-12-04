namespace RFFM.Api.Domain.Models
{
    public class TeamModel : TeamModelBase
    {
        public string Id { get; set; } = null!;

    }
    public class TeamModelBase
    {
        public string Name { get; set; } = null!;
        public int CategoryId { get; set; }
        public int? LeagueId { get; set; }
        public string ClubId { get; set; }
        public string? UrlPhoto { get; set; }
        public string SeasonId { get; set; }
        public int? LeagueGroup { get; set; }

    }
}
