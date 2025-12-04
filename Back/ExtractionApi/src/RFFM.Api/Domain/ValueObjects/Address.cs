namespace RFFM.Api.Domain.ValueObjects
{
    public class Address : ValueObject
    {
        public string? Street { get; set; } = string.Empty;
        public string? City { get; set; } = string.Empty;
        public string? Province { get; set; } = string.Empty;
        public string? PostalCode { get; set; } = string.Empty;
        public string? Country { get; set; } = string.Empty;

        protected override IEnumerable<object?> GetEqualityComponents()
        {
            yield return Street;
            yield return City;
            yield return Province;
            yield return PostalCode;
            yield return Country;
        }
    }
}
