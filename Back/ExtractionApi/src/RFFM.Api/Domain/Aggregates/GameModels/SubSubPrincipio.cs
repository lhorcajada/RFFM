namespace RFFM.Api.Domain.Aggregates.GameModels
{
    /// <summary>
    /// A SubSubPrincipio of the ADN hierarchy: "Sub-subprincipio X.Y.Z — Rol:" per spec §2.
    /// Hangs either off a Zona or directly off a Subprincipio — exactly one parent, never both
    /// (spec §0/§1.1 of the design).
    /// </summary>
    public class SubSubPrincipio : BaseEntity
    {
        public string? SubprincipioId { get; private set; }
        public string? ZonaId { get; private set; }
        public string Key { get; private set; } = null!;
        /// <summary>Literal numbering as written in the legible document, e.g. "1.1.1".</summary>
        public string Numero { get; private set; } = null!;
        public string Rol { get; private set; } = null!;
        public string Texto { get; private set; } = string.Empty;

        public Subprincipio? Subprincipio { get; private set; }
        public Zona? Zona { get; private set; }

        public List<Habilidad> Habilidades { get; private set; } = new();

        private SubSubPrincipio() { }

        public SubSubPrincipio(string key, string numero, string rol, string texto, string? subprincipioId, string? zonaId)
        {
            var parentCount = new[] { subprincipioId, zonaId }.Count(id => !string.IsNullOrEmpty(id));
            if (parentCount != 1)
                throw new ArgumentException("Exactly one of SubprincipioId or ZonaId must be set.");

            SubprincipioId = subprincipioId;
            ZonaId = zonaId;
            UpdateKey(key);
            UpdateNumero(numero);
            UpdateRol(rol);
            Texto = texto ?? string.Empty;
        }

        public void UpdateKey(string key)
        {
            if (string.IsNullOrWhiteSpace(key))
                throw new ArgumentException("Key cannot be empty.", nameof(key));
            Key = key.Trim();
        }

        public void UpdateNumero(string numero)
        {
            if (string.IsNullOrWhiteSpace(numero))
                throw new ArgumentException("Numero cannot be empty.", nameof(numero));
            Numero = numero.Trim();
        }

        public void UpdateRol(string rol)
        {
            if (string.IsNullOrWhiteSpace(rol))
                throw new ArgumentException("Rol cannot be empty.", nameof(rol));
            Rol = rol.Trim();
        }

        public void UpdateTexto(string texto) => Texto = texto ?? string.Empty;

        public void ReparentToSubprincipio(string subprincipioId)
        {
            if (string.IsNullOrWhiteSpace(subprincipioId))
                throw new ArgumentException("SubprincipioId cannot be empty.", nameof(subprincipioId));
            SubprincipioId = subprincipioId;
            ZonaId = null;
        }

        public void ReparentToZona(string zonaId)
        {
            if (string.IsNullOrWhiteSpace(zonaId))
                throw new ArgumentException("ZonaId cannot be empty.", nameof(zonaId));
            ZonaId = zonaId;
            SubprincipioId = null;
        }
    }
}
