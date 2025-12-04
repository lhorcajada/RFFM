namespace RFFM.Api.Domain.Aggregates.UserClubs
{
    public static class ValidationClub
    {
        public static void ValidateName(string name)
        {
            if (string.IsNullOrEmpty(name))
            {
                throw new ArgumentNullException(nameof(name), ValidationConstants.ClubNameCannotBeNullEmpty);
            }
            if (name.Length > ValidationConstants.ClubNameMaxLength)
            {
                throw new ArgumentOutOfRangeException(nameof(name),
                    string.Format(ValidationConstants.ClubNameCannotExceedMaxLength, 
                        ValidationConstants.ClubNameMaxLength));
            }
        }

        public static void ValidateCountryId(int countryId)
        {
            if (countryId <= 0)
            {
                throw new ArgumentOutOfRangeException(nameof(countryId), ValidationConstants.CountryIdMustBePositive);
            }
        }

        public static void ValidateShieldUrl(string? shieldUrl)
        {
            if (shieldUrl != null && shieldUrl.Length > ValidationConstants.ClubShieldUrlMaxLength)
            {
                throw new ArgumentOutOfRangeException(nameof(shieldUrl),
                    string.Format(ValidationConstants.ClubShieldUrlCannotExceedMaxLength, 
                        ValidationConstants.ClubShieldUrlMaxLength));
            }
        }
    }
}
