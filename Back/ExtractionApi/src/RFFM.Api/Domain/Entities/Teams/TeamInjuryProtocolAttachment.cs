namespace RFFM.Api.Domain.Entities.Teams
{
    /// <summary>
    /// One PDF attachment linked to a team's <see cref="TeamInjuryProtocol"/> (first-aid sheets,
    /// insurance forms, emergency contacts — see add-injury-protocol-and-documents-tabs,
    /// design.md Decisión 2). StorageUrl is whatever <c>IStorageService.UploadAsync</c> returns
    /// (same pattern as player/team photos).
    /// </summary>
    public class TeamInjuryProtocolAttachment : BaseEntity
    {
        public string ProtocolId { get; private set; } = null!;
        public string FileName { get; private set; } = null!;
        public string StorageUrl { get; private set; } = null!;
        public string ContentType { get; private set; } = null!;
        public DateTime UploadedAt { get; private set; }

        public TeamInjuryProtocol Protocol { get; private set; } = null!;

        private TeamInjuryProtocolAttachment() { }

        public static TeamInjuryProtocolAttachment Create(
            string protocolId, string fileName, string storageUrl, string contentType, DateTime? uploadedAt = null)
        {
            if (string.IsNullOrWhiteSpace(protocolId))
                throw new ArgumentException("El protocolo es obligatorio.");
            if (string.IsNullOrWhiteSpace(fileName))
                throw new ArgumentException("El nombre del fichero es obligatorio.");
            if (string.IsNullOrWhiteSpace(storageUrl))
                throw new ArgumentException("La URL de almacenamiento es obligatoria.");
            if (string.IsNullOrWhiteSpace(contentType))
                throw new ArgumentException("El tipo de contenido es obligatorio.");

            var uploaded = uploadedAt ?? DateTime.UtcNow;

            return new TeamInjuryProtocolAttachment
            {
                ProtocolId = protocolId,
                FileName = fileName,
                StorageUrl = storageUrl,
                ContentType = contentType,
                UploadedAt = uploaded.Kind == DateTimeKind.Utc ? uploaded : DateTime.SpecifyKind(uploaded, DateTimeKind.Utc)
            };
        }
    }
}
