using RFFM.Api.Domain.ValueObjects;
using RFFM.Api.Domain.ValueObjects.Player;

namespace RFFM.Api.Domain.Models
{
    public class PlayerSeasonModel
    {
        public string PlayerId { get; set; }
        public string TeamSeasonId { get; set; }
        public List<Demarcation> Demarcation { get; set; }
        public Dorsal? Dorsal { get; set; }
        public List<Family> Family { get; set; }
        public PhysicalAttributes PhysicalAttributes { get; set; }
        public PlayerContactInfo? ContactInfo { get; set; }
    }
}
