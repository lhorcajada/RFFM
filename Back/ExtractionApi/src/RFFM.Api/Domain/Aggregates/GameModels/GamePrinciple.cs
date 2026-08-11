namespace RFFM.Api.Domain.Aggregates.GameModels
{
    /// <summary>
    /// A Principio of the ADN hierarchy: "N. Título." within a Fase (GameMoment) — spec §1–§2.
    /// Fase-scoped only (no longer Fase×Zona); Zona now hangs off Subprincipio instead.
    /// </summary>
    public class GamePrinciple : BaseEntity
    {
        public string GameModelId { get; private set; } = null!;
        public int GameMomentId { get; private set; }
        public string Key { get; private set; } = null!;
        /// <summary>Literal numbering as written in the legible document, e.g. 1.</summary>
        public int Numero { get; private set; }
        public string Titulo { get; private set; } = null!;
        public string Texto { get; private set; } = string.Empty;

        public GameModel GameModel { get; private set; } = null!;
        public GameMoment GameMoment { get; private set; } = null!;

        public List<Subprincipio> Subprincipios { get; private set; } = new();

        private GamePrinciple() { }

        public GamePrinciple(string gameModelId, int gameMomentId, string key, int numero, string titulo, string texto)
        {
            if (string.IsNullOrWhiteSpace(gameModelId))
                throw new ArgumentException("GameModelId cannot be empty.", nameof(gameModelId));

            GameModelId = gameModelId;
            GameMomentId = gameMomentId;
            UpdateKey(key);
            Numero = numero;
            UpdateTitulo(titulo);
            Texto = texto ?? string.Empty;
        }

        public void UpdateKey(string key)
        {
            if (string.IsNullOrWhiteSpace(key))
                throw new ArgumentException("Key cannot be empty.", nameof(key));
            Key = key.Trim();
        }

        public void UpdateNumero(int numero) => Numero = numero;

        public void UpdateTitulo(string titulo)
        {
            if (string.IsNullOrWhiteSpace(titulo))
                throw new ArgumentException("Titulo cannot be empty.", nameof(titulo));
            Titulo = titulo.Trim();
        }

        public void UpdateTexto(string texto) => Texto = texto ?? string.Empty;
    }
}
