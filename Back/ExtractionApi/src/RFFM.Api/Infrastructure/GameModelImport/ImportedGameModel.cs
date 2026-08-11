namespace RFFM.Api.Infrastructure.GameModelImport
{
    /// <summary>
    /// In-memory tree produced by <see cref="AdnLegibleImporter"/> from the legible markdown,
    /// per the technical import spec §1/§6 — not persisted directly; a separate upsert step
    /// (importer's <c>UpsertAsync</c>) matches these against the DB by <c>Key</c>.
    /// </summary>
    public class ImportedGameModel
    {
        public List<ImportedPrincipio> Principios { get; } = new();
        public List<ImportedNota> Notas { get; } = new();
        public List<ImportedSetPieceRule> SetPieceRules { get; } = new();
        public List<ImportedOpenIssue> OpenIssues { get; } = new();
    }

    public class ImportedPrincipio
    {
        public required string FaseSlug { get; init; }
        public required string Key { get; init; }
        public required int Numero { get; init; }
        public required string Titulo { get; set; }
        public string Texto { get; set; } = string.Empty;
        public List<ImportedSubprincipio> Subprincipios { get; } = new();
    }

    public class ImportedSubprincipio
    {
        public required string Key { get; init; }
        public required string Numero { get; init; }
        public required string Titulo { get; set; }
        public string Texto { get; set; } = string.Empty;
        public List<ImportedZona> Zonas { get; } = new();
        public List<ImportedSubSubPrincipio> SubSubPrincipios { get; } = new();
    }

    public class ImportedZona
    {
        public required string Key { get; init; }
        public required string ZoneKeysCsv { get; init; }
        public string? Label { get; init; }
        public string? ZonaTexto { get; init; }
        public string Texto { get; set; } = string.Empty;
        public List<ImportedSubSubPrincipio> SubSubPrincipios { get; } = new();
    }

    public class ImportedSubSubPrincipio
    {
        public required string Key { get; init; }
        public required string Numero { get; init; }
        public required string Rol { get; set; }
        public string Texto { get; set; } = string.Empty;
        public List<ImportedHabilidad> Habilidades { get; } = new();
    }

    public class ImportedHabilidad
    {
        public required string Nombre { get; init; }
        public string Descripcion { get; set; } = string.Empty;
        public string Entrenable { get; set; } = string.Empty;
        /// <summary>Raw "X.Y.Z" captured from "(misma que X.Y.Z)" before second-pass resolution (spec §8).</summary>
        public string? ReferenciaRaw { get; set; }
        /// <summary>Fully-qualified key ("{faseSlug}-X.Y.Z"), resolved in the second pass.</summary>
        public string? ReferenciaAKey { get; set; }
    }

    public class ImportedNota
    {
        public required string AnchorKey { get; init; }
        public required string Tipo { get; init; }
        public required string Texto { get; init; }
    }

    public class ImportedSetPieceRule
    {
        public required string Subtype { get; init; }
        public string Texto { get; set; } = string.Empty;
    }

    public class ImportedOpenIssue
    {
        public required string Topic { get; init; }
        public string Description { get; init; } = string.Empty;
        public string Status { get; init; } = "open";
    }
}
