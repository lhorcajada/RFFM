namespace RFFM.Api.Features.Coaches.Players.Services
{
    /// <summary>
    /// Shared helper used by <see cref="PlayerFatigueCalculator"/>, <see cref="PlayerReadinessCalculator"/>
    /// and <see cref="PlayerFormStatusCalculator"/> to weigh a training session's contribution by
    /// which <c>TrainingType</c>(s) (Físico/Táctico/Técnico) were marked present in it. Each metric
    /// has its own weight table (different order of importance per metric) — see
    /// openspec/changes/player-form-status-training-match-weighting/design.md → Decisión 1.
    /// </summary>
    public static class TrainingTypeWeighting
    {
        // Sesión sin tipos marcados (TrainingTypes vacío): peso neutro 1.00 para las tres métricas.
        // TrainingTypes es un campo añadido en una migración reciente — cualquier entreno anterior,
        // o cualquier entreno nuevo donde el coach no marque ningún tipo, tiene la lista vacía.
        // Tratarlo como peso máximo preserva exactamente el comportamiento pre-change (todo entreno
        // cuenta igual) en vez de penalizar datos históricos o coaches que no rellenan el campo.
        public const double UntypedWeight = 1.0;

        /// <summary>
        /// Pondera una sesión por la media aritmética de los pesos de los tipos presentes en ELLA
        /// únicamente (un tipo ausente en esta sesión no participa en la media ni resta peso a los
        /// presentes de otras sesiones). Lista vacía o sin ningún tipo reconocido en el diccionario
        /// → <see cref="UntypedWeight"/> (defensivo/retrocompat).
        /// </summary>
        public static double Weight(IReadOnlyList<string> trainingTypesPresent, IReadOnlyDictionary<string, double> weightByCode)
        {
            if (trainingTypesPresent.Count == 0) return UntypedWeight;

            var matched = trainingTypesPresent
                .Where(weightByCode.ContainsKey)
                .Select(t => weightByCode[t])
                .ToList();

            return matched.Count == 0 ? UntypedWeight : matched.Average();
        }
    }
}
