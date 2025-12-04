namespace RFFM.Api.Domain.Aggregates.Technicals
{
    internal class ValidationTechnical
    {
        public static void ValidateName(string name)
        {
            if (string.IsNullOrEmpty(name))
            {
                throw new ArgumentNullException(nameof(name), ValidationConstants.TechnicalNameCannotBeNullEmpty);
            }
            if (name.Length > ValidationConstants.TechnicalNameMaxLength)
            {
                throw new ArgumentOutOfRangeException(nameof(name),
                    string.Format(ValidationConstants.TechnicalNameCannotExceedMaxLength,
                        ValidationConstants.TechnicalNameMaxLength));
            }

        }

        internal static void ValidateTechnicalTypeId(int technicalTypeId)
        {
            if (technicalTypeId <= 0)
            {
                throw new ArgumentOutOfRangeException(nameof(technicalTypeId),
                    ValidationConstants.TechnicalTypeIdMustBePositive);
            }
        }
    }
}