using RFFM.Api.Domain.Aggregates.Assistances;

namespace RFFM.Api.Features.Coaches.Players.Services
{
    /// <summary>
    /// Whether a convocation represents an absence attributable to the player — i.e. not the
    /// coach's own decision — used consistently across player statistics (season minutes target,
    /// squad "X de Y" attendance ratios, player convocation summary): accepted then no-show on
    /// the day (with or without excuse), or deconvoked for any reason other than the coach's
    /// technical decision. Never convoked at all, or deconvoked by technical decision, is NOT
    /// attributable to the player.
    /// </summary>
    public static class AttributableAbsenceCalculator
    {
        private static readonly int JustifiedStatusId = ConvocationStatus.FromName("Justified").Id;
        private static readonly int DeconvokeStatusId = ConvocationStatus.FromName("Deconvoke").Id;

        public static bool IsAttributableAbsence(int? assistanceTypeId, int? convocationStatusId, int? excuseTypeId)
        {
            if (assistanceTypeId == AssistanceType.ExcusedAbsence.Id || assistanceTypeId == AssistanceType.UnexcusedAbsence.Id)
                return true;

            return assistanceTypeId == null
                   && (convocationStatusId == JustifiedStatusId || convocationStatusId == DeconvokeStatusId)
                   && excuseTypeId != ExcuseTypes.TechnicalDecision.Id;
        }
    }
}
