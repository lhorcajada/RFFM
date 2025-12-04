namespace RFFM.Api.Domain.Aggregates.Assistances
{
    public class ConvocationStatus
    {
        private static readonly ConvocationStatus Pending = new ConvocationStatus(1, "Pending");
        private static readonly ConvocationStatus Accepted = new ConvocationStatus(2, "Accepted");
        private static readonly ConvocationStatus Declined = new ConvocationStatus(3, "Declined");
        private static readonly ConvocationStatus Justified = new ConvocationStatus(4, "Justified");
        public int Id { get; private set; }
        public string Name { get; private set; }
        private ConvocationStatus(int id, string name)
        {
            Id = id;
            Name = name;
        }
        public static IEnumerable<ConvocationStatus> List() => new[] { Pending, Accepted, Declined, Justified };
        public static ConvocationStatus FromName(string name)
        {
            var status = List()
                .SingleOrDefault(s => string.Equals(s.Name, name, StringComparison.CurrentCultureIgnoreCase));
            if (status == null)
            {
                throw new ArgumentException($"Possible values for ConvocationStatus: {string.Join(",", List().Select(s => s.Name))}");
            }
            return status;
        }
        public static ConvocationStatus From(int id)
        {
            var status = List()
                .SingleOrDefault(s => s.Id == id);
            if (status == null)
            {
                throw new ArgumentException($"Possible values for ConvocationStatus: {string.Join(",", List().Select(s => s.Name))}");
            }
            return status;
        }
        
    }
}
