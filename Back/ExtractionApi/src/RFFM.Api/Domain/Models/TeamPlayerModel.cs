
namespace RFFM.Api.Domain.Models
{
    public class TeamPlayerModel
    {
        public string PlayerId { get; set; } = null!;
        public PlayerModel PlayerModel { get; set; } = null!;
        public string TeamId { get; set; } = null!;
        public string SeasonId { get; set; } = null!;
        public int? Age { get; set; }
        public int? BirthYear { get; set; }
        public string? TeamName { get; set; }
        public string? TeamCategory { get; set; }
        public DateTime JoinedDate { get; set; }
        public DateTime? LeftDate { get; set; }
        public decimal? Height { get; set; }
        public decimal? Weight { get; set; }
        public int? DominantFootId { get; set; }
        public DemarcationModel? Demarcation { get; set; } = null!;
        public ContactModel? ContactInfo { get; set; }
        public DorsalModel? Dorsal { get; set; }
        public List<FamilyModel> FamilyMembers { get; set; } = null!;

    }
}
