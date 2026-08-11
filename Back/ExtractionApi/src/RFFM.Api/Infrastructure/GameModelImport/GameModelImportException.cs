namespace RFFM.Api.Infrastructure.GameModelImport
{
    /// <summary>
    /// Raised when the importer encounters an unresolvable Zona heading (spec §3/§8) or an
    /// out-of-vocabulary Habilidad name (spec §4/§8) — these are rejected, never guessed.
    /// </summary>
    public class GameModelImportException : Exception
    {
        public GameModelImportException(string message) : base(message) { }
    }
}
