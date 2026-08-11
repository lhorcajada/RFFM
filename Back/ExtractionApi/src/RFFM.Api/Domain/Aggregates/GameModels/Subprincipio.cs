namespace RFFM.Api.Domain.Aggregates.GameModels
{
    /// <summary>
    /// A Subprincipio of the ADN hierarchy: "Subprincipio X.Y — Título." per the technical
    /// import spec §1–§2. Its SubSubPrincipios hang either off its Zonas (if any) or directly
    /// off it, never both (see spec §0).
    /// </summary>
    public class Subprincipio : BaseEntity
    {
        public string GamePrincipleId { get; private set; } = null!;
        public string Key { get; private set; } = null!;
        /// <summary>Literal numbering as written in the legible document, e.g. "1.1".</summary>
        public string Numero { get; private set; } = null!;
        public string Titulo { get; private set; } = null!;
        public string Texto { get; private set; } = string.Empty;

        public GamePrinciple GamePrinciple { get; private set; } = null!;

        public List<Zona> Zonas { get; private set; } = new();
        public List<SubSubPrincipio> SubSubPrincipios { get; private set; } = new();

        private Subprincipio() { }

        public Subprincipio(string gamePrincipleId, string key, string numero, string titulo, string texto)
        {
            if (string.IsNullOrWhiteSpace(gamePrincipleId))
                throw new ArgumentException("GamePrincipleId cannot be empty.", nameof(gamePrincipleId));

            GamePrincipleId = gamePrincipleId;
            UpdateKey(key);
            UpdateNumero(numero);
            UpdateTitulo(titulo);
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

        public void UpdateTitulo(string titulo)
        {
            if (string.IsNullOrWhiteSpace(titulo))
                throw new ArgumentException("Titulo cannot be empty.", nameof(titulo));
            Titulo = titulo.Trim();
        }

        public void UpdateTexto(string texto) => Texto = texto ?? string.Empty;
    }
}
