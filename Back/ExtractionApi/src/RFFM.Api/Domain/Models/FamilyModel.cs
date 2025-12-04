namespace RFFM.Api.Domain.Models
{
    public class FamilyModel
    {
        public AddressModel? Address { get; set; } = null!;
        public string? Phone { get; set; } = null!;
        public string? Email { get; set; } = null!;
        public string? Name { get; set; } = null!;
        public int? FamilyMemberId { get; set; }
    }
}
