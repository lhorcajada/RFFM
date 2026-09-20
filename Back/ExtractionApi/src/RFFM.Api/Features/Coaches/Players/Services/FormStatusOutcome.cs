using RFFM.Api.Domain.Aggregates.Assistances;

namespace RFFM.Api.Features.Coaches.Players.Services
{
    public enum ParticipationOutcome { Attended, Absent, Excluded }

    /// <summary>
    /// Clasifica una convocatoria como asistida / falta / excluida para Estado de forma, con el
    /// la definición de falta imputable de <see cref="AttributableAbsenceCalculator"/> (la misma que
    /// alimenta el contador de ausencias). Toda falta cuenta 0 sin distinguir motivo; solo se
    /// excluye la decisión técnica del entrenador, el no convocado y lo pendiente. Diverge
    /// intencionadamente de Rodaje (PointsFor) en el deconvocado sin asistencia.
    /// See openspec/changes/player-form-status-received-offered-load/design.md → Decisión 4.
    /// </summary>
    public static class FormStatusOutcome
    {
        public static ParticipationOutcome Classify(int? assistanceTypeId, int? convocationStatusId, int? excuseTypeId)
        {
            if (excuseTypeId == ExcuseTypes.FromId(1)?.Id) return ParticipationOutcome.Absent;     // Lesión
            if (excuseTypeId == ExcuseTypes.FromId(7)?.Id) return ParticipationOutcome.Excluded;   // Decisión técnica
            if (assistanceTypeId == AssistanceType.Attendance.Id || assistanceTypeId == AssistanceType.LateArrival.Id)
                return ParticipationOutcome.Attended;
            if (assistanceTypeId == AssistanceType.UnexcusedAbsence.Id || assistanceTypeId == AssistanceType.ExcusedAbsence.Id)
                return ParticipationOutcome.Absent;
            // Falta imputable (Excused/Unexcused, o sin asistencia y Justified/Deconvoke con motivo
            // distinto de decision tecnica): misma definicion que el contador de ausencias de la app.
            if (AttributableAbsenceCalculator.IsAttributableAbsence(assistanceTypeId, convocationStatusId, excuseTypeId))
                return ParticipationOutcome.Absent;
            return ParticipationOutcome.Excluded;
        }

        public static string ReasonFor(int? assistanceTypeId, int? excuseTypeId)
        {
            if (excuseTypeId is not null && ExcuseTypes.FromId(excuseTypeId.Value) is { } excuse) return excuse.Name;
            if (assistanceTypeId is not null) return AssistanceType.From(assistanceTypeId.Value).Name;
            return "Sin motivo registrado";
        }
    }
}
