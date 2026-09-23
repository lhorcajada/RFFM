namespace RFFM.Api.Domain.Entities.Audit
{
    /// <summary>
    /// Fixed, code-reviewed catalog of audited event types (openspec change
    /// user-activity-audit-log, design.md Decision 2). New types are added here as a code
    /// change, deliberately — not a DB-editable catalog like DocumentType.
    /// </summary>
    public sealed class AuditEventType
    {
        public static readonly AuditEventType PageAccess = new(1, "PageAccess");
        public static readonly AuditEventType ConvocationAccepted = new(2, "ConvocationAccepted");
        public static readonly AuditEventType ConvocationRejected = new(3, "ConvocationRejected");
        public static readonly AuditEventType PlayerEdited = new(4, "PlayerEdited");

        public int Id { get; }
        public string Name { get; }

        private AuditEventType(int id, string name)
        {
            Id = id;
            Name = name;
        }

        public static IEnumerable<AuditEventType> List() =>
            new[] { PageAccess, ConvocationAccepted, ConvocationRejected, PlayerEdited };

        public static AuditEventType FromName(string name)
        {
            var type = List().SingleOrDefault(t => string.Equals(t.Name, name, StringComparison.OrdinalIgnoreCase));
            return type ?? throw new ArgumentException($@"Unknown AuditEventType name: {name}", nameof(name));
        }

        public static AuditEventType FromId(int id)
        {
            var type = List().SingleOrDefault(t => t.Id == id);
            return type ?? throw new ArgumentException($@"Unknown AuditEventType id: {id}", nameof(id));
        }

        public override string ToString() => Name;
        public static implicit operator string(AuditEventType t) => t.Name;
    }
}
