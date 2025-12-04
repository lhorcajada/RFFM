namespace RFFM.Api.Domain.Entities.Competitions
{
    public class Category
    {
        public string Name { get; }
        public int Id { get; }

        private static readonly Dictionary<int, Category> Categories = new Dictionary<int, Category>();

        private Category(int id, string name)
        {
            Id = id;
            Name = name;
            Categories[id] = this;
        }

        public static Category GetById(int id)
        {
            return Categories.GetValueOrDefault(id)!;
        }
        public static IEnumerable<Category> GetAll()
        {
            return Categories.Values;
        }

        public override string ToString()
        {
            return Name;
        }

        public static readonly Category NationalCategory = new Category(1, "Categoría Nacional");
        public static readonly Category Amateurs = new Category(2, "Aficionados");
        public static readonly Category Youth = new Category(3, "Juveniles");
        public static readonly Category U14 = new Category(4, "Cadetes");
        public static readonly Category U12 = new Category(5, "Infantiles");
        public static readonly Category U10 = new Category(6, "Alevines");
        public static readonly Category U08 = new Category(7, "Benjamines");
        public static readonly Category U06 = new Category(8, "Prebenjamines");
        public static readonly Category U04 = new Category(9, "Debutantes");
    }
}
