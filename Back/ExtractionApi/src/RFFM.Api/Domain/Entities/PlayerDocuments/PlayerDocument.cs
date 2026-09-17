namespace RFFM.Api.Domain.Entities.PlayerDocuments
{
    /// <summary>
    /// One document/authorization instance for a specific season-scoped TeamPlayer + DocumentType
    /// pair. Keyed by (TeamPlayerId, DocumentTypeId) — NOT by PlayerId/SeasonId, because TeamPlayer
    /// is already season-scoped (a new TeamPlayer.Id per season). See openspec change
    /// player-document-authorizations, design.md Decision 2.
    /// "Pending" is never persisted here — its absence (no row) IS the Pending state, synthesized
    /// by query handlers (design.md Decision 3).
    /// </summary>
    public class PlayerDocument : BaseEntity
    {
        public string TeamPlayerId { get; private set; } = null!;
        public string DocumentTypeId { get; private set; } = null!;
        public PlayerDocumentStatus Status { get; private set; } = null!;
        public string FileName { get; private set; } = null!;
        public string StorageUrl { get; private set; } = null!;
        public string ContentType { get; private set; } = null!;
        public DateTime UploadedAt { get; private set; }
        public string UploadedByUserId { get; private set; } = null!;
        public bool UploadedOnBehalf { get; private set; }
        public string? ReviewedByUserId { get; private set; }
        public DateTime? ReviewedAt { get; private set; }
        public string? ReviewNote { get; private set; }

        private PlayerDocument() { }

        public static PlayerDocument Create(
            string teamPlayerId, string documentTypeId, string fileName, string storageUrl,
            string contentType, string uploadedByUserId, bool uploadedOnBehalf)
        {
            if (string.IsNullOrWhiteSpace(teamPlayerId))
                throw new ArgumentException("El jugador es obligatorio.");
            if (string.IsNullOrWhiteSpace(documentTypeId))
                throw new ArgumentException("El tipo de documento es obligatorio.");

            var doc = new PlayerDocument
            {
                TeamPlayerId = teamPlayerId,
                DocumentTypeId = documentTypeId
            };
            doc.ReplaceFile(fileName, storageUrl, contentType, uploadedByUserId, uploadedOnBehalf);
            return doc;
        }

        /// <summary>
        /// Replaces the stored file, always resetting to Delivered and clearing any prior review
        /// — regardless of the previous status (design.md Decision 4). Callers are responsible for
        /// deleting the previous StorageUrl from IStorageService before/after calling this.
        /// </summary>
        public void ReplaceFile(
            string fileName, string storageUrl, string contentType, string uploadedByUserId, bool uploadedOnBehalf)
        {
            FileName = fileName;
            StorageUrl = storageUrl;
            ContentType = contentType;
            UploadedByUserId = uploadedByUserId;
            UploadedOnBehalf = uploadedOnBehalf;
            UploadedAt = DateTime.UtcNow;
            Status = PlayerDocumentStatus.Delivered;
            ReviewedByUserId = null;
            ReviewedAt = null;
            ReviewNote = null;
        }

        public void Approve(string reviewedByUserId, string? note)
        {
            EnsureDelivered();
            Status = PlayerDocumentStatus.Approved;
            ReviewedByUserId = reviewedByUserId;
            ReviewedAt = DateTime.UtcNow;
            ReviewNote = note;
        }

        public void Reject(string reviewedByUserId, string? note)
        {
            EnsureDelivered();
            Status = PlayerDocumentStatus.Rejected;
            ReviewedByUserId = reviewedByUserId;
            ReviewedAt = DateTime.UtcNow;
            ReviewNote = note;
        }

        private void EnsureDelivered()
        {
            if (Status != PlayerDocumentStatus.Delivered)
                throw new InvalidOperationException(
                    $"Solo se puede revisar un documento en estado Delivered (estado actual: {Status.Name}).");
        }
    }
}
