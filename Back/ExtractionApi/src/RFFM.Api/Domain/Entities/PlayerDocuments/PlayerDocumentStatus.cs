using Ardalis.SmartEnum;

namespace RFFM.Api.Domain.Entities.PlayerDocuments
{
    /// <summary>
    /// Persisted states of a PlayerDocument. "Pending" is intentionally NOT a member here — it is
    /// a DTO-only value synthesized by query handlers when no PlayerDocument row exists yet for a
    /// TeamPlayer + DocumentType pair (design.md Decision 3). Never persist "Pending".
    /// </summary>
    public sealed class PlayerDocumentStatus : SmartEnum<PlayerDocumentStatus>
    {
        public static readonly PlayerDocumentStatus Delivered = new(nameof(Delivered), 1);
        public static readonly PlayerDocumentStatus Approved = new(nameof(Approved), 2);
        public static readonly PlayerDocumentStatus Rejected = new(nameof(Rejected), 3);

        private PlayerDocumentStatus(string name, int value) : base(name, value)
        {
        }
    }
}
