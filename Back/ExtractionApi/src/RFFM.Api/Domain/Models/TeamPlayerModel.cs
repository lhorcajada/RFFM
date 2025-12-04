
namespace RFFM.Api.Domain.Models
{
    public class TeamPlayerModel
    {
        public string PlayerId { get; set; } = null!;
        public string TeamId { get; set; } = null!;
        public DateTime JoinedDate { get; set; }
        public DateTime? LeftDate { get; set; }
        public DemarcationModel? Demarcation { get; set; } = null!;
        public ContactModel? ContactInfo { get; set; }
        public int? Dorsal { get; set; }
        public decimal? Height { get; set; }
        public decimal? Weight { get; set; }
        public int? DominantFootId { get; set; }
        public FamilyModel? Family { get; set; }

    }
}
