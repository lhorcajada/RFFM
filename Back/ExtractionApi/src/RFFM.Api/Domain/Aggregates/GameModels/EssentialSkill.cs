namespace RFFM.Api.Domain.Aggregates.GameModels
{
    /// <summary>
    /// An indispensable skill linked to a sub-sub-principle.
    /// e.g. "Perfilamiento defensivo: Colocar el cuerpo para..."
    /// </summary>
    public class EssentialSkill : BaseEntity
    {
        public string SubSubPrincipleId { get; private set; } = null!;
        public string Name { get; private set; } = null!;
        public string Description { get; private set; } = string.Empty;

        /// <summary>When the coach marks this skill as mastered by the players.</summary>
        public DateTime? MasteredAt { get; set; }

        public SubSubPrinciple SubSubPrinciple { get; private set; } = null!;

        private EssentialSkill() { }

        public EssentialSkill(string subSubPrincipleId, string name, string description)
        {
            SubSubPrincipleId = subSubPrincipleId;
            UpdateName(name);
            Description = description;
        }

        public void UpdateName(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Skill name cannot be empty.", nameof(name));
            Name = name.Trim();
        }

        public void UpdateDescription(string description) => Description = description;
    }
}
