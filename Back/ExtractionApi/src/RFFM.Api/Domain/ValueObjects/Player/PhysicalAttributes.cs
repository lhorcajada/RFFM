using RFFM.Api.Domain.Entities.PlayerFeet;

namespace RFFM.Api.Domain.ValueObjects.Player
{
    public class PhysicalAttributes : ValueObject
    {
        public decimal? Height { get; private set; } 
        public decimal? Weight { get; private set; } 
        public PlayerFeet? DominantFoot { get; private set; } 
        public PhysicalAttributes() { }

        public PhysicalAttributes(decimal? height, decimal? weight, PlayerFeet? dominantFoot)
        {
            if (height is <= 0) throw new ArgumentException("Height must be greater than 0.");
            if (weight is <= 0) throw new ArgumentException("Weight must be greater than 0.");

            Height = height;
            Weight = weight;
            DominantFoot = dominantFoot;
        }

        protected override IEnumerable<object?> GetEqualityComponents()
        {
            yield return Height;
            yield return Weight;
            yield return DominantFoot;
        }
    }

}
