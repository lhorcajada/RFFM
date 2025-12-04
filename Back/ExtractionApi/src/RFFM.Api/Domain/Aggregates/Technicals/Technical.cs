namespace RFFM.Api.Domain.Aggregates.Technicals
{
    public class Technical : BaseEntity, IAggregateRoot
    {
        public string Name { get; private set; }
        public int TechnicalTypeId { get; private set; }
        public TechnicalType TechnicalType { get; private set; } = null!;

        public Technical(string name, int technicalTypeId)
        {
           UpdateName(name);
           UpdateTechnicalType(TechnicalTypeId);
        }

        public void UpdateName(string name)
        {
            ValidationTechnical.ValidateName(name);
            Name = name;
        }

        public void UpdateTechnicalType(int technicalTypeId)
        {
            ValidationTechnical.ValidateTechnicalTypeId(technicalTypeId);
            TechnicalTypeId = technicalTypeId;
        }
    }
}
