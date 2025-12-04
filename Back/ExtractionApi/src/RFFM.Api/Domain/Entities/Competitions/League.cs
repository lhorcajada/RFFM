namespace RFFM.Api.Domain.Entities.Competitions
{
    public class League
    {
        public int Id { get; }
        public string Name { get; }
        public int CategoryId { get; }
        public Category Category { get; } = null!;

        public League(){}
        public League(int id, string name, int categoryId)
        {
            ValidationCategory.ValidateName(name);
            Name = name;
            Id = id;
            CategoryId = categoryId;
        }

    }
}
