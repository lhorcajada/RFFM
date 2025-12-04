namespace RFFM.Api.Domain.Aggregates.Assistances
{
    public class SportEventType
    {
        private static readonly SportEventType Match = new SportEventType(1, "Partido");
        private static readonly SportEventType Training = new SportEventType(2, "Entrenamiento");
        private static readonly SportEventType Meeting = new SportEventType(3, "Reunión");
        private static readonly SportEventType FriendlyMatch = new SportEventType(4, "Amistoso");


        public int Id { get; private set; }
        public string Name { get; private set; }
        private SportEventType(int id, string name)
        {
            Id = id;
            Name = name;
        }

        public static IEnumerable<SportEventType> List() => new[] { Match, Training, Meeting, FriendlyMatch };

        public static SportEventType FromName(string name)
        {
            var eventType = List()
                .SingleOrDefault(s => string.Equals(s.Name, name, StringComparison.CurrentCultureIgnoreCase));
            if (eventType == null)
            {
                throw new ArgumentException($"Possible values for EventType: {string.Join(",", List().Select(s => s.Name))}");
            }
            return eventType;
        }
        public static SportEventType From(int id)
        {
            var eventType = List()
                .SingleOrDefault(s => s.Id == id);
            if (eventType == null)
            {
                throw new ArgumentException($"Possible values for EventType: {string.Join(",", List().Select(s => s.Name))}");
            }
            return eventType;
        }

        public static void ValidateEventType(int id)
        {
            var eventType = List()
                .SingleOrDefault(s => s.Id == id);
            if (eventType == null)
            {
                throw new ArgumentException($"Possible values for EventType: {string.Join(",", List().Select(s => s.Name))}");
            }

        }
    }
}
