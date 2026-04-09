using RFFM.Api.Domain;

namespace RFFM.Api.Domain.Entities.Formations
{
    public class Formation : BaseEntity
    {
        public string Name { get; private set; } = string.Empty;
        public string? Description { get; private set; }

        protected Formation() { }

        public static Formation Create(string name, string? description = null)
        {
            return new Formation { Name = name, Description = description };
        }
    }
}
