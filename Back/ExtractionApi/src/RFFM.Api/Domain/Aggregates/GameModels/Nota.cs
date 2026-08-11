namespace RFFM.Api.Domain.Aggregates.GameModels
{
    /// <summary>
    /// A Nota anchored to exactly one level of the ADN tree (Principio, Subprincipio, Zona or
    /// SubSubPrincipio) — excepciones, riesgos aceptados, objetivos de temporada (spec §0/§2).
    /// </summary>
    public class Nota : BaseEntity
    {
        public static readonly IReadOnlySet<string> Tipos = new HashSet<string>
        {
            "riesgo-aceptado", "objetivo-temporada", "nota", "excepcion"
        };

        public string GameModelId { get; private set; } = null!;
        public string Tipo { get; private set; } = null!;
        public string Texto { get; private set; } = string.Empty;

        public string? PrincipioId { get; private set; }
        public string? SubprincipioId { get; private set; }
        public string? ZonaId { get; private set; }
        public string? SubSubPrincipioId { get; private set; }

        public GameModel GameModel { get; private set; } = null!;

        private Nota() { }

        public Nota(string gameModelId, string tipo, string texto,
            string? principioId, string? subprincipioId, string? zonaId, string? subSubPrincipioId)
        {
            if (string.IsNullOrWhiteSpace(gameModelId))
                throw new ArgumentException("GameModelId cannot be empty.", nameof(gameModelId));

            var anchorCount = new[] { principioId, subprincipioId, zonaId, subSubPrincipioId }
                .Count(id => !string.IsNullOrEmpty(id));
            if (anchorCount != 1)
                throw new ArgumentException("Exactly one anchor (PrincipioId, SubprincipioId, ZonaId or SubSubPrincipioId) must be set.");

            GameModelId = gameModelId;
            UpdateTipo(tipo);
            Texto = texto ?? string.Empty;

            PrincipioId = principioId;
            SubprincipioId = subprincipioId;
            ZonaId = zonaId;
            SubSubPrincipioId = subSubPrincipioId;
        }

        public void UpdateTipo(string tipo)
        {
            if (string.IsNullOrWhiteSpace(tipo) || !Tipos.Contains(tipo))
                throw new ArgumentException($"'{tipo}' is not a valid Nota tipo.", nameof(tipo));
            Tipo = tipo;
        }

        public void UpdateTexto(string texto) => Texto = texto ?? string.Empty;
    }
}
