namespace RFFM.Api.Domain.ValueObjects.Player
{
    public class Dorsal : ValueObject
    {
        public int Number { get; private set; }

        public Dorsal(int number)
        {
            if (number is <= 0 or > 99)
                throw new ArgumentException(ValidationConstants.LimitDorsal);

            Number = number;
        }

        protected override IEnumerable<object?> GetEqualityComponents()
        {
            yield return Number;
        }
    }

}
