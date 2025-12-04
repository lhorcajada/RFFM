namespace RFFM.Api.Domain.ValueObjects.Player
{
    public class PlayerContactInfo : ValueObject
    {
        public Address? Address { get; private set; }
        public string? Phone { get; private set; }
        public string? Email { get; private set; }

        public PlayerContactInfo(){}

        public PlayerContactInfo(Address? address, string? phone, string? email)
        {
            Address = address;
            Phone = phone;
            Email = email;
        }



        protected override IEnumerable<object?> GetEqualityComponents()
        {
            yield return Address;
            yield return Phone;
            yield return Email;
        }
    }

}
