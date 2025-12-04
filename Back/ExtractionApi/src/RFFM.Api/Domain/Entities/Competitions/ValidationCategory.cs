namespace RFFM.Api.Domain.Entities.Competitions
{
    public class ValidationCategory
    {
        public static void ValidateName(string name)
        {
            if (string.IsNullOrEmpty(name))
            {
                throw new ArgumentNullException(nameof(name), ValidationConstants.CategoryNameCannotBeNullEmpty);
            }
            if (name.Length > ValidationConstants.CategoryNameMaxLength)
            {
                throw new ArgumentOutOfRangeException(nameof(name),
                    string.Format(ValidationConstants.CategoryNameCannotExceedMaxLength,
                        ValidationConstants.CategoryNameMaxLength));
            }
        }
    }
}