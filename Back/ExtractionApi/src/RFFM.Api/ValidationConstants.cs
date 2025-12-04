namespace RFFM.Api
{
    public class ValidationConstants
    {
        public const int ClubNameMaxLength = 200;
        public const string ClubNameCannotBeNullEmpty = "Club name cannot be null or empty.";
        public const string ClubNameCannotExceedMaxLength = "Club name cannot exceed {0} characters.";
        public const string CountryIdMustBePositive = "Country ID must be a positive integer.";
        public const int ClubShieldUrlMaxLength = 500;
        public const string ClubShieldUrlCannotExceedMaxLength = "Club shield URL cannot exceed {0} characters.";
        public const int CountryCodeMaxLength = 3;
        public const int SeasonNameMaxLength = 200;
        public const string SeasonNameCannotBeNullEmpty = "Season name cannot be null or empty.";
        public const string SeasonNameCannotExceedMaxLength = "Season name cannot exceed {0} characters.";
        public const int TeamNameMaxLength = 500;
        public const int TechnicalNameMaxLength = 200;
        public const string TechnicalNameCannotBeNullEmpty = "Technical name cannot be null or empty.";
        public const string TechnicalNameCannotExceedMaxLength = "Technical name cannot exceed {0} characters."; 
        public const int PlayerNameMaxLength = 500;
        public const string PlayerNameCannotBeNullEmpty = "Player name cannot be null or empty.";
        public const string PlayerNameCannotExceedMaxLength = "League name cannot exceed {0} characters.";
        public const int PlayerLastNameMaxLength = 2000;
        public const string PlayerLastNameCannotExceedMaxLength = "Player Lastname cannot exceed {0} characters";
        public const string CategoryNameCannotBeNullEmpty = "League name cannot be null or empty.";
        public const string CategoryNameCannotExceedMaxLength = "League name cannot exceed {0} characters.";
        public const string TechnicalTypeIdMustBePositive = "Technical type ID must be a positive integer.";
        public const string ClubIdCannotBeNullEmpty = "Club ID cannot be null or empty.";
        public const int PlayerUrlPhotoMaxLength = 500;
        public const string PlayerUrlPhotoCannotExceedMaxLength = "Player URL photo cannot exceed {0} characters.";
        public const string PlayerAliasCannotBeNullEmpty = "Player alias cannot be null or empty.";
        public const int PlayerAliasMaxLength = 100;
        public const string PlayerAliasCannotExceedMaxLength = "Player alias cannot exceed {0} characters.";
        public const string PlayerBirthDateCannotBeInFuture = "Player birth date cannot be in the future.";
        public static readonly DateTime PlayerBirthDateMinValue = new(1900, 1, 1);
        public const string PlayerBirthDateCannotBeBeforeMinValue = "Player birth date cannot be before {0}.";
        public const string PlayerDniCannotExceedMaxLength = "Player DNI cannot exceed {0} characters.";
        public const int PlayerDniMaxLength = 20;
        public const string PlayerDniMustBeValid = "Player DNI must be a valid format.";
        public const int PlayTypeNameMaxLength = 250;
        public const int CategoryNameMaxLength = 500;
        public const int LeagueNameMaxLength = 500;
        public const string LimitDorsal = "Player dorsal must be between 0 and 99 characters.";
        public const string LeastOneDemarcation = "At least one position must be provided";
        public const string MustBeActiveOneDemarcation = "Active position must be one of the possible positions.";
        public const int StreetMaxLength = 1000;
        public const int CityMaxLength = 100;
        public const int ProvinceMaxLength = 100;
        public const int PostalCodeMaxLength = 20;
        public const int CountryMaxLength = 100;
        public const int PhoneMaxLength = 20;
        public const int EmailMaxLength = 500;
        public const int DemarcationNameMaxLength = 50;
        public const int RoleNameMaxLength = 100;
        public const int RoleKeyMaxLength = 100;
        public const int ApplicationUserIdMaxLength = 450;
        public const int TeamUrlPhotoMaxLength = 500;
        public const string TeamCategoryIdMustBeGreaterThanZero = "League Id must be zero.";
        public const int SessionTrainingNameMaxLength = 200;
        public const int SessionTrainingDescriptionMaxLength = 2000;
        public const int SessionTrainingLocationMaxLength = 500;
        public const int SessionTrainingUrlImageMaxLength = 500;
        public const int TaskTrainingBaseNameMaxLength = 200;
        public const int TaskTrainingBaseDescriptionMaxLength = 2000;
        public const int TaskTrainingBaseFieldSpaceMaxLength = 100;
        public const int TaskTrainingBaseUrlImageMaxLength = 500;


    }
}
