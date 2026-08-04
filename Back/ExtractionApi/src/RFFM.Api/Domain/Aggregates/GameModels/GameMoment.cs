namespace RFFM.Api.Domain.Aggregates.GameModels
{
    /// <summary>
    /// Catalog entity: a phase/moment of play.
    /// e.g. Defensa Organizada, Ataque Organizado, Transición Defensa→Ataque, etc.
    /// </summary>
    public class GameMoment
    {
        public int Id { get; private set; }
        public string Name { get; private set; } = null!;
        public int Order { get; private set; }
        public bool IsActive { get; private set; } = true;

        public List<GamePrinciple> Principles { get; private set; } = new();

        private GameMoment() { }

        public GameMoment(string name, int order)
        {
            UpdateName(name);
            Order = order;
        }

        public void UpdateName(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Moment name cannot be empty.", nameof(name));
            Name = name.Trim();
        }

        public void UpdateOrder(int order) => Order = order;
        public void SetActive(bool isActive) => IsActive = isActive;
    }
}
