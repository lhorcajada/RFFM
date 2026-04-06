namespace RFFM.Api.Domain.Aggregates.GameModels
{
    /// <summary>
    /// Sub-sub-principle inside a sub-principle.
    /// e.g. "1: El lateral de banda activa acosa y orienta"
    /// </summary>
    public class SubSubPrinciple : BaseEntity
    {
        public string SubPrincipleId { get; private set; } = null!;
        public string Name { get; private set; } = null!;
        /// <summary>Player action description.</summary>
        public string Action { get; private set; } = string.Empty;
        /// <summary>Display order within the sub-principle (1-based).</summary>
        public int Order { get; private set; }

        public SubPrinciple SubPrinciple { get; private set; } = null!;
        public List<EssentialSkill> EssentialSkills { get; private set; } = new();

        private SubSubPrinciple() { }

        public SubSubPrinciple(string subPrincipleId, string name, string action, int order = 0)
        {
            SubPrincipleId = subPrincipleId;
            UpdateName(name);
            Action = action;
            Order = order;
        }

        public void UpdateName(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Sub-sub-principle name cannot be empty.", nameof(name));
            Name = name.Trim();
        }

        public void UpdateAction(string action) => Action = action;

        public void UpdateOrder(int order) => Order = order;

        public void ReparentTo(string subPrincipleId) => SubPrincipleId = subPrincipleId;
    }
}
