namespace RFFM.Api.Domain.Entities.PlayerDocuments
{
    /// <summary>
    /// A reusable, data-backed document/authorization type (e.g. "Autorización para realizar
    /// físico fuera de las instalaciones"). New types are added as rows, not code — see
    /// openspec change player-document-authorizations, design.md Decision 1.
    /// </summary>
    public class DocumentType : BaseEntity
    {
        public string Name { get; private set; } = null!;
        public string? Description { get; private set; }
        public bool IsActive { get; private set; }

        private DocumentType() { }

        public static DocumentType Create(string name, string? description)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("El nombre del tipo de documento es obligatorio.");

            return new DocumentType
            {
                Name = name,
                Description = description,
                IsActive = true
            };
        }
    }
}
