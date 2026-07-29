namespace RFFM.Api.Domain.Entities
{
    /// <summary>
    /// Attendance status for an event confirmation.
    /// </summary>
    public sealed class AttendanceStatus
    {
        public int Id { get; }
        public string Name { get; }

        private AttendanceStatus(int id, string name)
        {
            Id = id;
            Name = name;
        }

        public static readonly AttendanceStatus Pending = new AttendanceStatus(0, "Pending");
        public static readonly AttendanceStatus Going = new AttendanceStatus(1, "Going");
        public static readonly AttendanceStatus NotGoing = new AttendanceStatus(2, "NotGoing");

        public static IEnumerable<AttendanceStatus> List() => new[] { Pending, Going, NotGoing };

        public static AttendanceStatus FromId(int id)
        {
            var item = List().SingleOrDefault(a => a.Id == id);
            return item ?? throw new ArgumentException($"Unknown AttendanceStatus id: {id}", nameof(id));
        }

        public static AttendanceStatus FromName(string name)
        {
            var item = List().SingleOrDefault(a => string.Equals(a.Name, name, StringComparison.OrdinalIgnoreCase));
            return item ?? throw new ArgumentException($"Unknown AttendanceStatus name: {name}", nameof(name));
        }

        public override string ToString() => Name;

        public static implicit operator string(AttendanceStatus a) => a.Name;
    }
}
