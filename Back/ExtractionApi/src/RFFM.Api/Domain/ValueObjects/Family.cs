namespace RFFM.Api.Domain.ValueObjects
{
    public class Family : ValueObject
    {
        public Address? Address { get; private set; }
        public string? Phone { get; private set; }
        public string? Email { get; private set; }
        public string? Name { get; private set; }
        public string? FamilyMember { get; private set; }
        public Family() { }

        public Family(Address? address, string? phone, string? email, string? name, string? familyMember)
        {
            Address = address;
            Phone = phone;
            Email = email;
            Name = name;
            FamilyMember = familyMember;
        }

        protected override IEnumerable<object?> GetEqualityComponents()
        {
            yield return Address;
            yield return Phone;
            yield return Email;
            yield return Name;
        }
    }
}
