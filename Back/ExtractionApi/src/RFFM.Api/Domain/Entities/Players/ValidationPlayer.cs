namespace RFFM.Api.Domain.Entities.Players
{
    internal class ValidationPlayer
    {
        internal static void ValidateAlias(string alias)
        {
            if (string.IsNullOrEmpty(alias))
            {
                throw new ArgumentNullException(nameof(alias), ValidationConstants.PlayerAliasCannotBeNullEmpty);
            }
            if (alias.Length > ValidationConstants.PlayerAliasMaxLength)
            {
                throw new ArgumentOutOfRangeException(nameof(alias),
                    string.Format(ValidationConstants.PlayerAliasCannotExceedMaxLength,
                        ValidationConstants.PlayerAliasMaxLength));
            }
        }

        internal static void ValidateBirthDate(DateTime? birthDay)
        {
            if(birthDay == null)
            {
                return;
            }
            if (birthDay > DateTime.Now)
            {
                throw new ArgumentOutOfRangeException(nameof(birthDay),
                    ValidationConstants.PlayerBirthDateCannotBeInFuture);
            }
            if (birthDay < ValidationConstants.PlayerBirthDateMinValue)
            {
                throw new ArgumentOutOfRangeException(nameof(birthDay),
                    string.Format(ValidationConstants.PlayerBirthDateCannotBeBeforeMinValue,
                        ValidationConstants.PlayerBirthDateMinValue));
            }
        }

        internal static void ValidateDni(string? dni)
        {
            if (string.IsNullOrEmpty(dni))
            {
                return;
            }

            if (dni.Length > ValidationConstants.PlayerDniMaxLength)
            {
                throw new ArgumentOutOfRangeException(nameof(dni),
                    string.Format(ValidationConstants.PlayerDniCannotExceedMaxLength,
                        ValidationConstants.PlayerDniMaxLength));
            }

            if (!DniValidator.IsValid(dni))
            {
                throw new ArgumentException(ValidationConstants.PlayerDniMustBeValid, nameof(dni));
            }

        }

        internal static void ValidateLastName(string? lastName)
        {
            if(string.IsNullOrEmpty(lastName))
            {
                return;
            }
            if (lastName.Length > ValidationConstants.PlayerLastNameMaxLength)
            {
                throw new ArgumentNullException(nameof(lastName), ValidationConstants.PlayerLastNameCannotExceedMaxLength);

            }
        }

        internal static void ValidateName(string name)
        {
            if (string.IsNullOrEmpty(name))
            {
                throw new ArgumentNullException(nameof(name), ValidationConstants.PlayerNameCannotBeNullEmpty);
            }
            if (name.Length > ValidationConstants.PlayerNameMaxLength)
            {
                throw new ArgumentOutOfRangeException(nameof(name),
                    string.Format(ValidationConstants.PlayerNameCannotExceedMaxLength,
                        ValidationConstants.PlayerNameMaxLength));
            }
        }

        internal static void ValidateUrlPhoto(string? urlPhoto)
        {
            if (urlPhoto is { Length: > ValidationConstants.PlayerUrlPhotoMaxLength })
            {
                throw new ArgumentOutOfRangeException(nameof(urlPhoto),
                    string.Format(ValidationConstants.PlayerUrlPhotoCannotExceedMaxLength,
                        ValidationConstants.PlayerUrlPhotoMaxLength));
            }
        }
    }
}