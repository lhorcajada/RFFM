namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    /// <summary>
    /// Catálogo cerrado de rasgos de actitud que el cuerpo técnico valora por jugador.
    /// See openspec/changes/player-tracking-attitude/design.md → D1.
    /// </summary>
    public static class AttitudeTraits
    {
        public static readonly IReadOnlyList<KeyValuePair<string, string>> All = new List<KeyValuePair<string, string>>
        {
            new("defensive-commitment", "Implicación en tareas defensivas"),
            new("patience", "Paciencia con balón"),
            new("courage-in-duels", "Valentía en los duelos"),
            new("off-ball-effort", "Esfuerzo sin balón"),
            new("listening", "Escucha y aplicación de consignas"),
            new("focus", "Concentración durante la tarea"),
        };

        public static bool IsKnown(string? key) => key is not null && All.Any(t => t.Key == key);

        /// <summary>Etiqueta en español del rasgo; si la clave ya no existe en el catálogo, la propia clave.</summary>
        public static string LabelOf(string key) => All.FirstOrDefault(t => t.Key == key).Value ?? key;
    }
}
