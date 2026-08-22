namespace RFFM.Api.Domain.Aggregates.SeasonPlans
{
    /// <summary>
    /// A target `Subprincipio` reference for a Microciclo's week — reference-only intent, no
    /// FOCO/INTEGRADO tag and no Habilidad selection (those remain exclusively on
    /// `ExerciseModelRelation`, at the exercise level). Per the `season-plan-target-subprincipios`
    /// OpenSpec change (design.md §1): a real join table, not jsonb, so the reference silently
    /// disappears if the Subprincipio is later removed from the team's GameModel (see the
    /// cascade FK in `MicrocicloSubprincipioObjetivoConfiguration`), same as
    /// `ExerciseModelRelation`. Built only via <see cref="Microciclo.ReplaceSubprincipiosObjetivo"/>.
    /// </summary>
    public class MicrocicloSubprincipioObjetivo : BaseEntity
    {
        public string MicrocicloId { get; private set; } = null!;
        public string SubprincipioId { get; private set; } = null!;

        private MicrocicloSubprincipioObjetivo() { }

        public MicrocicloSubprincipioObjetivo(string microcicloId, string subprincipioId)
        {
            if (string.IsNullOrWhiteSpace(microcicloId))
                throw new ArgumentException("MicrocicloId cannot be empty.", nameof(microcicloId));
            if (string.IsNullOrWhiteSpace(subprincipioId))
                throw new ArgumentException("SubprincipioId cannot be empty.", nameof(subprincipioId));

            MicrocicloId = microcicloId;
            SubprincipioId = subprincipioId;
        }
    }
}
