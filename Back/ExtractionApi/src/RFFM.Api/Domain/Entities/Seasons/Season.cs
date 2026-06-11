using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Domain.Entities.Seasons
{
    public class Season : BaseEntity
    {
        public string Name { get; private set; }
        public DateTime StartDate { get; private set; }
        public DateTime EndDate { get; private set; }
        public bool IsActive { get; private set; }
        public string? ClubId { get; private set; }
        public Club? Club { get; private set; }


        public static Season Create(string name, DateTime startDate, DateTime endDate, bool isActive, Club club)
            => new Season(name, startDate, endDate, isActive, club);

        private Season() { }

        private Season(string name, DateTime startDate, DateTime endDate, bool isActive, Club club)
        {
            ValidationSeason.ValidateName(name);
            ValidationSeason.ValidatePeriod(startDate, endDate);
            Name = name;
            StartDate = NormalizeDate(startDate);
            EndDate = NormalizeDate(endDate);
            IsActive = isActive;
            ClubId = club.Id;
        }

        public void UpdateName(string name)
        {
            ValidationSeason.ValidateName(name);
            Name = name;
        }

        public void UpdatePeriod(DateTime startDate, DateTime endDate)
        {
            ValidationSeason.ValidatePeriod(startDate, endDate);
            StartDate = NormalizeDate(startDate);
            EndDate = NormalizeDate(endDate);
        }

        public void UpdateIsActive(bool isActive)
        {
            IsActive = isActive;
        }

        private static DateTime NormalizeDate(DateTime date)
            => date.Kind == DateTimeKind.Utc ? date : DateTime.SpecifyKind(date, DateTimeKind.Utc);
    }
}
