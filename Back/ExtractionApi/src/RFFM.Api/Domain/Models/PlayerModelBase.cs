namespace RFFM.Api.Domain.Models
{
    public class PlayerModel : PlayerModelBase
    {
        public string Id { get; set; } = null!;


    }
    public class PlayerModelBase
    {
        public string Name { get; set; } = null!;
        public string? LastName { get; set; } = null!;
        public string Alias { get; set; } = null!;
        public string? UrlPhoto { get; set; }
        public DateTime? BirthDate { get; set; }
        public string? Dni { get; set; }
        public string ClubId { get; set; } = null!;
        public int? Age { get; set; }
        public int? BirthYear { get; set; }
        public string? LastTeamName { get; set; }
        public string? LastTeamCategory { get; set; }

    }
}
