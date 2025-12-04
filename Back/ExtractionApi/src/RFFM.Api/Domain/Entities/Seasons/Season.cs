namespace RFFM.Api.Domain.Entities.Seasons
{
    public class Season : BaseEntity
    {
        public string Name { get; private set; }
        public bool IsActive { get; private set; }

        public Season(string name, bool isActive)
        {
            ValidationSeason.ValidateName(name);
            Name = name;
            IsActive = isActive;
        }

        public void UpdateName(string name)
        {
            ValidationSeason.ValidateName(name);
            Name = name;
        }

        public void UpdateIsActive(bool isActive)
        {
            IsActive = isActive;

        }
    }
}
