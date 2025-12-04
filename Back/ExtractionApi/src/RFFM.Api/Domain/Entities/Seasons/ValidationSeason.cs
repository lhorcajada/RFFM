namespace RFFM.Api.Domain.Entities.Seasons
{
    public static class ValidationSeason
    {
        public static void ValidateName(string name)
        {
            if (string.IsNullOrEmpty(name))
            {
                throw new ArgumentNullException(nameof(name), ValidationConstants.SeasonNameCannotBeNullEmpty);
            }
            if (name.Length > ValidationConstants.SeasonNameMaxLength)
            {
                throw new ArgumentOutOfRangeException(nameof(name),
                    string.Format(ValidationConstants.SeasonNameCannotExceedMaxLength, 
                        ValidationConstants.SeasonNameMaxLength));
            }
        }

        internal static void ValidateClubId(string clubId)
        {
            if (string.IsNullOrEmpty(clubId))
            {
                throw new ArgumentNullException(nameof(clubId), ValidationConstants.ClubIdCannotBeNullEmpty);
            }
        }
    }
}
