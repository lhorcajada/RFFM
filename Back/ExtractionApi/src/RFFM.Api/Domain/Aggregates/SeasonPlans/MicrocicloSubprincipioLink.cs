namespace RFFM.Api.Domain.Aggregates.SeasonPlans
{
    /// <summary>
    /// Links a Microciclo session (A or B) to a concrete <c>Subprincipio</c> node from the
    /// team's current GameModel. Built only via <see cref="Microciclo.ReplaceSubprincipioLinks"/>,
    /// which always clears and rebuilds a session's rows (no incremental diffing), mirroring
    /// <c>TeamRule</c>'s ownership-by-aggregate pattern.
    /// </summary>
    public class MicrocicloSubprincipioLink : BaseEntity
    {
        public string MicrocicloId { get; private set; } = null!;
        public string Session { get; private set; } = null!;
        public string SubprincipioId { get; private set; } = null!;

        private MicrocicloSubprincipioLink() { }

        internal MicrocicloSubprincipioLink(string microcicloId, string session, string subprincipioId)
        {
            if (string.IsNullOrWhiteSpace(microcicloId))
                throw new ArgumentException("MicrocicloId cannot be empty.", nameof(microcicloId));
            if (string.IsNullOrWhiteSpace(subprincipioId))
                throw new ArgumentException("SubprincipioId cannot be empty.", nameof(subprincipioId));

            MicrocicloId = microcicloId;
            Session = session;
            SubprincipioId = subprincipioId;
        }
    }
}
