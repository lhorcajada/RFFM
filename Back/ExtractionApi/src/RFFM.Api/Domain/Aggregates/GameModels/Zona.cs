namespace RFFM.Api.Domain.Aggregates.GameModels
{
    /// <summary>
    /// A Zona of the ADN hierarchy, hanging off a Subprincipio (spec §0/§3). Zonas can reference
    /// one or more catalog zone keys, the pseudo-values "todas"/"compuesta", or a compound case
    /// with free-text (<see cref="ZonaTexto"/>) for cases that don't fit the 4-zone catalog.
    /// </summary>
    public class Zona : BaseEntity
    {
        /// <summary>Closed set of zone key tokens per spec §1, plus the pseudo-values "todas"/"compuesta".</summary>
        public static readonly IReadOnlySet<string> KnownZoneKeys = new HashSet<string>
        {
            "iniciacion", "creacion-propia", "creacion-rival", "finalizacion", "todas", "compuesta"
        };

        public string SubprincipioId { get; private set; } = null!;
        public string Key { get; private set; } = null!;
        /// <summary>Comma-separated zone key tokens (see <see cref="KnownZoneKeys"/>), e.g. "creacion-propia,iniciacion".</summary>
        public string ZoneKeysCsv { get; private set; } = null!;
        /// <summary>Optional sub-grouping label within the same Subprincipio, e.g. "Ataque del centro".</summary>
        public string? Label { get; private set; }
        /// <summary>Free text describing a "compuesta" zone that doesn't fit the catalog (spec §3).</summary>
        public string? ZonaTexto { get; private set; }
        public string Texto { get; private set; } = string.Empty;

        public Subprincipio Subprincipio { get; private set; } = null!;
        public List<SubSubPrincipio> SubSubPrincipios { get; private set; } = new();

        private Zona() { }

        public Zona(string subprincipioId, string key, string zoneKeysCsv, string? label, string? zonaTexto, string texto)
        {
            if (string.IsNullOrWhiteSpace(subprincipioId))
                throw new ArgumentException("SubprincipioId cannot be empty.", nameof(subprincipioId));

            SubprincipioId = subprincipioId;
            UpdateKey(key);
            UpdateZoneKeysCsv(zoneKeysCsv);
            UpdateLabel(label);
            UpdateZonaTexto(zonaTexto);
            Texto = texto ?? string.Empty;

            if (ZoneKeysCsv.Split(',', StringSplitOptions.TrimEntries).Contains("compuesta") && string.IsNullOrWhiteSpace(ZonaTexto))
                throw new ArgumentException("A 'compuesta' zone requires ZonaTexto.", nameof(zonaTexto));
        }

        public void UpdateKey(string key)
        {
            if (string.IsNullOrWhiteSpace(key))
                throw new ArgumentException("Key cannot be empty.", nameof(key));
            Key = key.Trim();
        }

        public void UpdateZoneKeysCsv(string zoneKeysCsv)
        {
            if (string.IsNullOrWhiteSpace(zoneKeysCsv))
                throw new ArgumentException("ZoneKeysCsv cannot be empty.", nameof(zoneKeysCsv));

            var tokens = zoneKeysCsv.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            if (tokens.Length == 0)
                throw new ArgumentException("ZoneKeysCsv cannot be empty.", nameof(zoneKeysCsv));

            var unknown = tokens.FirstOrDefault(t => !KnownZoneKeys.Contains(t));
            if (unknown is not null)
                throw new ArgumentException($"Unknown zone key: '{unknown}'.", nameof(zoneKeysCsv));

            ZoneKeysCsv = string.Join(',', tokens);
        }

        public void UpdateLabel(string? label) => Label = string.IsNullOrWhiteSpace(label) ? null : label.Trim();

        public void UpdateZonaTexto(string? zonaTexto) => ZonaTexto = string.IsNullOrWhiteSpace(zonaTexto) ? null : zonaTexto.Trim();

        public void UpdateTexto(string texto) => Texto = texto ?? string.Empty;
    }
}
