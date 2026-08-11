namespace RFFM.Api.Domain.Aggregates.GameModels
{
    /// <summary>
    /// An indispensable skill ("Habilidad imprescindible") linked to a SubSubPrincipio.
    /// <see cref="Nombre"/> is restricted to the 14-value closed vocabulary in spec §4 — no
    /// free-text skill names, and no own key (spec §1.4): addressed by (SubSubPrincipioId, Nombre).
    /// </summary>
    public class Habilidad : BaseEntity
    {
        /// <summary>The 14-value closed vocabulary from the technical import spec §4.</summary>
        public static readonly IReadOnlySet<string> Vocabulary = new HashSet<string>
        {
            "Perfilamiento", "Anticipación", "Activación", "Carga", "Temporización", "Comunicación",
            "Entrada", "Conducción", "Protección de balón", "Control orientado", "Pase", "Centro",
            "Remate", "Remate de cabeza"
        };

        public string SubSubPrincipioId { get; private set; } = null!;
        public string Nombre { get; private set; } = null!;
        public string Descripcion { get; private set; } = string.Empty;
        public string Entrenable { get; private set; } = string.Empty;
        /// <summary>When set (from "(misma que X.Y.Z)"), this Habilidad references another SubSubPrincipio's
        /// key instead of duplicating Descripcion/Entrenable (spec §2).</summary>
        public string? ReferenciaAKey { get; private set; }

        public SubSubPrincipio SubSubPrincipio { get; private set; } = null!;

        private Habilidad() { }

        public Habilidad(string subSubPrincipioId, string nombre, string descripcion, string entrenable, string? referenciaAKey)
        {
            if (string.IsNullOrWhiteSpace(subSubPrincipioId))
                throw new ArgumentException("SubSubPrincipioId cannot be empty.", nameof(subSubPrincipioId));

            SubSubPrincipioId = subSubPrincipioId;
            UpdateNombre(nombre);
            Descripcion = descripcion ?? string.Empty;
            Entrenable = entrenable ?? string.Empty;
            ReferenciaAKey = string.IsNullOrWhiteSpace(referenciaAKey) ? null : referenciaAKey.Trim();
        }

        public void UpdateNombre(string nombre)
        {
            if (string.IsNullOrWhiteSpace(nombre) || !Vocabulary.Contains(nombre))
                throw new ArgumentException($"'{nombre}' is not a valid Habilidad name. Must be one of the 14-value closed vocabulary.", nameof(nombre));
            Nombre = nombre;
        }

        public void UpdateDescripcion(string descripcion) => Descripcion = descripcion ?? string.Empty;

        public void UpdateEntrenable(string entrenable) => Entrenable = entrenable ?? string.Empty;

        public void UpdateReferenciaAKey(string? referenciaAKey) =>
            ReferenciaAKey = string.IsNullOrWhiteSpace(referenciaAKey) ? null : referenciaAKey.Trim();
    }
}
