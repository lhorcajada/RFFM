namespace RFFM.Api.Domain.Aggregates.Training
{
    public class MaterialsEnum
    {
        public static MaterialsEnum Cones = new MaterialsEnum(1, "Conos");
        public static MaterialsEnum Balls = new MaterialsEnum(2, "Balones");
        public static MaterialsEnum Bibs = new MaterialsEnum(3, "Chalecos");
        public static MaterialsEnum Poles = new MaterialsEnum(4, "Picas");
        public static MaterialsEnum AgilityLadders = new MaterialsEnum(5, "Escaleras de agilidad");
        public static MaterialsEnum Hurdles = new MaterialsEnum(6, "Vallas");
        public static MaterialsEnum Chines = new MaterialsEnum(7, "Setas");
        public static MaterialsEnum None = new MaterialsEnum(8, "Ninguno");

        public int Id { get; private set; }
        public string Name { get; private set; }

        private MaterialsEnum(int id, string name)
        {
            Id = id;
            Name = name;
        }
       public static IEnumerable<MaterialsEnum> List() =>
           new[] { Cones, Balls, Bibs, Poles, AgilityLadders, Hurdles, Chines, None };
        public static MaterialsEnum FromName(string name)
        {
            var state = List()
                .SingleOrDefault(s => string.Equals(s.Name, name, StringComparison.CurrentCultureIgnoreCase));
            if (state == null)
            {
                throw new ArgumentException($"Possible values for Materials: {string.Join(",", List().Select(s => s.Name))}");
            }
            return state;
        }
        public static MaterialsEnum From(int id)
        {
            var state = List().SingleOrDefault(s => s.Id == id);
            if (state == null)
            {
                throw new ArgumentException($"Possible values for Materials: {string.Join(",", List().Select(s => s.Name))}");
            }
            return state;
        }


    }
}
