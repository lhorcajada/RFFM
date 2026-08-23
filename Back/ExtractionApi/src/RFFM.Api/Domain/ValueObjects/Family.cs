namespace RFFM.Api.Domain.ValueObjects
{
    public class Family : ValueObject
    {
        public Address? Address { get; private set; }
        public string? Phone { get; private set; }
        public string? Email { get; private set; }
        public string? Name { get; private set; }
        public string? FamilyMember { get; private set; }
        public string? Dni { get; private set; }
        public Family() { }

        public Family(Address? address, string? phone, string? email, string? name, string? familyMember, string? dni = null)
        {
            Address = address;
            Phone = phone;
            Email = email;
            Name = name;
            FamilyMember = familyMember;
            Dni = dni;
        }

        /// <summary>
        /// Updates this instance's values in place instead of being replaced by a new one.
        /// Used by <see cref="TeamPlayers.TeamPlayer.SetFamily"/> when editing an existing
        /// family member so EF Core keeps tracking the same owned-entity identity (the shadow
        /// "Id" key) rather than trying to insert a brand new row without a key.
        /// </summary>
        internal void UpdateDetails(Address? address, string? phone, string? email, string? name, string? familyMember, string? dni = null)
        {
            Address = address;
            Phone = phone;
            Email = email;
            Name = name;
            FamilyMember = familyMember;
            Dni = dni;
        }

        protected override IEnumerable<object?> GetEqualityComponents()
        {
            yield return Address;
            yield return Phone;
            yield return Email;
            yield return Name;
            yield return Dni;
        }
    }
}
