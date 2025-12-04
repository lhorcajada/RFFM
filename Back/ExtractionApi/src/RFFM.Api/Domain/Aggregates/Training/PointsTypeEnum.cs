namespace RFFM.Api.Domain.Aggregates.Training
{
    public class PointsTypeEnum
    {
        public static PointsTypeEnum Physical = new PointsTypeEnum(1, "Físico");
        public static PointsTypeEnum Technical = new PointsTypeEnum(2, "Técnico");
        public static PointsTypeEnum Tactical = new PointsTypeEnum(3, "Táctico");
        public static PointsTypeEnum Psychological = new PointsTypeEnum(4, "Psicológico");
        public int Id { get; private set; }
        public string Name { get; private set; }
        private PointsTypeEnum(int id, string name)
        {
            Id = id;
            Name = name;
        }
        public static IEnumerable<PointsTypeEnum> List() =>
             new[] { Physical, Technical, Tactical, Psychological };

        public static PointsTypeEnum FromName(string name) =>
            List()
                .SingleOrDefault(s => string.Equals(s.Name, name, StringComparison.CurrentCultureIgnoreCase))
                ?? throw new ArgumentException($"Possible values for PointsType: {string.Join(",", List().Select(s => s.Name))}");
        public static PointsTypeEnum From(int id) =>
            List().SingleOrDefault(s => s.Id == id)
                ?? throw new ArgumentException($"Possible values for PointsType: {string.Join(",", List().Select(s => s.Name))}");
    }
}
