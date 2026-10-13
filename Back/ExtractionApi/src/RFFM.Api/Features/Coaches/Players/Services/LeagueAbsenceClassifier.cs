using RFFM.Api.Domain.Aggregates.Assistances;

namespace RFFM.Api.Features.Coaches.Players.Services
{
    /// <summary>
    /// Why a player missed a league match. League matches ask the whole squad for availability
    /// before the coach picks the call-up, so a Convocation row does not mean the player was
    /// convoked: it can record that they were unavailable (their own reason) or that the coach
    /// left them out (technical decision). Only an absence recorded on the day is a real
    /// "convoked but did not attend".
    /// </summary>
    public static class LeagueAbsenceClassifier
    {
        public const string Unavailable = "Unavailable";
        public const string TechnicalDecision = "TechnicalDecision";
        public const string NoShow = "NoShow";

        private static readonly int JustifiedStatusId = ConvocationStatus.FromName("Justified").Id;
        private static readonly int DeconvokeStatusId = ConvocationStatus.FromName("Deconvoke").Id;

        /// <summary>Null when the convocation is not an absence.</summary>
        public static string? KindFor(int? assistanceTypeId, int? convocationStatusId, int? excuseTypeId)
        {
            if (assistanceTypeId == AssistanceType.ExcusedAbsence.Id || assistanceTypeId == AssistanceType.UnexcusedAbsence.Id)
                return NoShow;

            var leftOutBeforeTheMatch = assistanceTypeId == null
                && (convocationStatusId == JustifiedStatusId || convocationStatusId == DeconvokeStatusId);
            if (!leftOutBeforeTheMatch)
                return null;

            return excuseTypeId == ExcuseTypes.TechnicalDecision.Id ? TechnicalDecision : Unavailable;
        }

        public static string? ReasonFor(int? excuseTypeId) =>
            excuseTypeId is { } id ? ExcuseTypes.FromId(id)?.Name : null;
    }
}
