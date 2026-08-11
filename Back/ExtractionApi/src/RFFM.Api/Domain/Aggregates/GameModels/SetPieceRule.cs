namespace RFFM.Api.Domain.Aggregates.GameModels
{
    /// <summary>
    /// A flat entry of the "Balón parado" phase — no Principio/Subprincipio/Zona nesting
    /// (spec §5). Always belongs conceptually to the "balon-parado" GameMoment.
    /// </summary>
    public class SetPieceRule : BaseEntity
    {
        public static readonly IReadOnlySet<string> Subtypes = new HashSet<string>
        {
            "corners-defensivos", "corners-ofensivos", "faltas-defendiendo",
            "faltas-atacando", "saques-banda", "saque-porteria", "saque-centro", "penaltis"
        };

        public string GameModelId { get; private set; } = null!;
        public string Subtype { get; private set; } = null!;
        public string Texto { get; private set; } = string.Empty;

        public GameModel GameModel { get; private set; } = null!;

        private SetPieceRule() { }

        public SetPieceRule(string gameModelId, string subtype, string texto)
        {
            if (string.IsNullOrWhiteSpace(gameModelId))
                throw new ArgumentException("GameModelId cannot be empty.", nameof(gameModelId));

            GameModelId = gameModelId;
            UpdateSubtype(subtype);
            Texto = texto ?? string.Empty;
        }

        public void UpdateSubtype(string subtype)
        {
            if (string.IsNullOrWhiteSpace(subtype) || !Subtypes.Contains(subtype))
                throw new ArgumentException($"'{subtype}' is not a valid SetPieceRule subtype.", nameof(subtype));
            Subtype = subtype;
        }

        public void UpdateTexto(string texto) => Texto = texto ?? string.Empty;
    }
}
