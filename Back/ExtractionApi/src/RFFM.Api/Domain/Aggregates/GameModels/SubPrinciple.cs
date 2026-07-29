namespace RFFM.Api.Domain.Aggregates.GameModels
{
    /// <summary>
    /// Sub-principle inside a scenario.
    /// e.g. "A: EVITAR QUE EL RIVAL PROFUNDICE POR BANDA"
    /// </summary>
    public class SubPrinciple : BaseEntity
    {
        public string GameScenarioId { get; private set; } = null!;
        /// <summary>Display label: A, B, C or 1, 2, 3 …</summary>
        public string Label { get; private set; } = null!;
        public string Name { get; private set; } = null!;
        public string Context { get; private set; } = string.Empty;
        /// <summary>Display order within the scenario (1-based).</summary>
        public int Order { get; private set; }

        public GameScenario GameScenario { get; private set; } = null!;

        public List<SubSubPrinciple> SubSubPrinciples { get; private set; } = new();

        private SubPrinciple() { }

        public SubPrinciple(string gameScenarioId, string label, string name, string context, int order = 0)
        {
            GameScenarioId = gameScenarioId;
            UpdateLabel(label);
            UpdateName(name);
            Context = context;
            Order = order;
        }

        public void UpdateLabel(string label)
        {
            if (string.IsNullOrWhiteSpace(label))
                throw new ArgumentException("Label cannot be empty.", nameof(label));
            Label = label.Trim();
        }

        public void UpdateName(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Sub-principle name cannot be empty.", nameof(name));
            Name = name.Trim();
        }

        public void UpdateContext(string context) => Context = context;

        public void UpdateOrder(int order) => Order = order;
    }
}
