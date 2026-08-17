namespace RFFM.Api.Domain.Aggregates.SeasonPlans
{
    /// <summary>
    /// Links a Microciclo session (A or B) to a concrete <c>SubSubPrincipio</c> node from the
    /// team's current GameModel. Built only via <see cref="Microciclo.ReplaceSubSubPrincipioLinks"/>,
    /// which always clears and rebuilds a session's rows (no incremental diffing), mirroring
    /// <c>TeamRule</c>'s ownership-by-aggregate pattern.
    /// </summary>
    public class MicrocicloSubSubPrincipioLink : BaseEntity
    {
        public string MicrocicloId { get; private set; } = null!;
        public string Session { get; private set; } = null!;
        public string SubSubPrincipioId { get; private set; } = null!;

        private MicrocicloSubSubPrincipioLink() { }

        internal MicrocicloSubSubPrincipioLink(string microcicloId, string session, string subSubPrincipioId)
        {
            if (string.IsNullOrWhiteSpace(microcicloId))
                throw new ArgumentException("MicrocicloId cannot be empty.", nameof(microcicloId));
            if (string.IsNullOrWhiteSpace(subSubPrincipioId))
                throw new ArgumentException("SubSubPrincipioId cannot be empty.", nameof(subSubPrincipioId));

            MicrocicloId = microcicloId;
            Session = session;
            SubSubPrincipioId = subSubPrincipioId;
        }
    }
}
