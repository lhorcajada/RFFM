namespace RFFM.Api.Domain.Aggregates.Assistances
{
    public class AssistanceType
    {
        public static readonly AssistanceType Attendance = new AssistanceType(1, "Asiste", 5);
        public static readonly AssistanceType ExcusedAbsence = new AssistanceType(2, "No asiste con excusa", 0);
        public static readonly AssistanceType UnexcusedAbsence = new AssistanceType(3, "No asiste sin excusa", 0);
        public static readonly AssistanceType LateArrival = new AssistanceType(4, "Llega tarde", 2);
        public int Id { get; private set; }
        public string Name { get; private set; }
        public int Points { get; private set; }
        private AssistanceType(int id, string name, int points)
        {
            Id = id;
            Name = name;
            Points = points;
        }

        public static AssistanceType[] List() => new[] { Attendance, ExcusedAbsence, UnexcusedAbsence, LateArrival };

        public static AssistanceType FromName(string name)
        {
            var assistanceType = List()
                .SingleOrDefault(s => string.Equals(s.Name, name, StringComparison.CurrentCultureIgnoreCase));
            if (assistanceType == null)
            {
                throw new ArgumentException($"Possible values for AssistanceType: {string.Join(",", List().Select(s => s.Name))}");
            }
            return assistanceType;
        }
        public static AssistanceType From(int id)
        {
            var assistanceType = List()
                .SingleOrDefault(s => s.Id == id);
            if (assistanceType == null)
            {
                throw new ArgumentException($"Possible values for AssistanceType: {string.Join(",", List().Select(s => s.Name))}");
            }
            return assistanceType;
        }

    }

}
