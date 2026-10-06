namespace RFFM.Api.Domain.Entities
{
    public class UserPersonalData : BaseEntity
    {
        public static class Rules
        {
            public const int NameMaxLength = 50;
            public const int PhoneMaxLength = 20;
            public const int AvatarUrlMaxLength = 500;
        }

        public string ApplicationUserId { get; private set; } = string.Empty;
        public string FirstName { get; private set; } = string.Empty;
        public string LastName { get; private set; } = string.Empty;
        public string? SecondLastName { get; private set; }
        public string? PhoneNumber { get; private set; }
        public string? AvatarUrl { get; private set; }
        public DateTime CreatedAt { get; private set; }
        public DateTime UpdatedAt { get; private set; }

        private UserPersonalData() { }

        public static UserPersonalData Create(string applicationUserId, string firstName, string lastName,
            string? secondLastName, string? phoneNumber)
        {
            if (string.IsNullOrWhiteSpace(applicationUserId))
                throw new DomainException("UserPersonalData", "El usuario es obligatorio.", ErrorCodes.MissingRequiredArgument);

            var now = DateTime.UtcNow;
            var data = new UserPersonalData
            {
                ApplicationUserId = applicationUserId,
                CreatedAt = now,
            };
            data.Update(firstName, lastName, secondLastName, phoneNumber);
            return data;
        }

        public void Update(string firstName, string lastName, string? secondLastName, string? phoneNumber)
        {
            var namesMissing = string.IsNullOrWhiteSpace(firstName) || string.IsNullOrWhiteSpace(lastName);
            if (namesMissing)
                throw new DomainException("UserPersonalData", "El nombre y el primer apellido son obligatorios.",
                    ErrorCodes.PersonalDataNameRequired);

            FirstName = firstName.Trim();
            LastName = lastName.Trim();
            SecondLastName = NullIfBlank(secondLastName);
            PhoneNumber = NullIfBlank(phoneNumber);
            UpdatedAt = DateTime.UtcNow;
        }

        public void SetAvatar(string url)
        {
            AvatarUrl = url;
            UpdatedAt = DateTime.UtcNow;
        }

        public string? RemoveAvatar()
        {
            var previous = AvatarUrl;
            AvatarUrl = null;
            UpdatedAt = DateTime.UtcNow;
            return previous;
        }

        private static string? NullIfBlank(string? value) =>
            string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
