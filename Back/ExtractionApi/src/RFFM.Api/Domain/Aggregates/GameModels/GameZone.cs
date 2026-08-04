namespace RFFM.Api.Domain.Aggregates.GameModels
{
    /// <summary>
    /// Catalog entity: zone within a game moment.
    /// e.g. Zona de Iniciación, Zona de Creación CP, Zona de Creación CR, Zona de Finalización.
    /// </summary>
    public class GameZone
    {
        public int Id { get; private set; }
        public string Name { get; private set; } = null!;
        public int Order { get; private set; }
        public bool IsActive { get; private set; } = true;

        public List<GamePrinciple> Principles { get; private set; } = new();

        private GameZone() { }

        public GameZone(string name, int order)
        {
            UpdateName(name);
            Order = order;
        }

        public void UpdateName(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Zone name cannot be empty.", nameof(name));
            Name = name.Trim();
        }

        public void UpdateOrder(int order) => Order = order;
        public void SetActive(bool isActive) => IsActive = isActive;
    }
}
