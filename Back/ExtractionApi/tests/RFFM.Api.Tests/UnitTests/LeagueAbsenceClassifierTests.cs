#nullable enable
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Features.Coaches.Players.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class LeagueAbsenceClassifierTests
    {
        private static readonly int AcceptedStatusId = ConvocationStatus.FromName("Accepted").Id;
        private static readonly int JustifiedStatusId = ConvocationStatus.FromName("Justified").Id;
        private static readonly int DeconvokeStatusId = ConvocationStatus.FromName("Deconvoke").Id;

        [Fact]
        public void KindFor_DeconvokedForPlayerReason_IsUnavailable()
        {
            var kind = LeagueAbsenceClassifier.KindFor(null, DeconvokeStatusId, ExcuseTypes.Injury.Id);

            Assert.Equal(LeagueAbsenceClassifier.Unavailable, kind);
        }

        [Fact]
        public void KindFor_JustifiedWithoutExcuse_IsUnavailable()
        {
            var kind = LeagueAbsenceClassifier.KindFor(null, JustifiedStatusId, null);

            Assert.Equal(LeagueAbsenceClassifier.Unavailable, kind);
        }

        [Fact]
        public void KindFor_DeconvokedByTechnicalDecision_IsTechnicalDecision()
        {
            var kind = LeagueAbsenceClassifier.KindFor(null, DeconvokeStatusId, ExcuseTypes.TechnicalDecision.Id);

            Assert.Equal(LeagueAbsenceClassifier.TechnicalDecision, kind);
        }

        [Theory]
        [MemberData(nameof(AbsenceAssistanceTypeIds))]
        public void KindFor_ConvokedButAbsentOnTheDay_IsNoShow(int assistanceTypeId)
        {
            var kind = LeagueAbsenceClassifier.KindFor(assistanceTypeId, AcceptedStatusId, null);

            Assert.Equal(LeagueAbsenceClassifier.NoShow, kind);
        }

        [Fact]
        public void KindFor_AcceptedAndAttended_IsNotAnAbsence()
        {
            var kind = LeagueAbsenceClassifier.KindFor(AssistanceType.Attendance.Id, AcceptedStatusId, null);

            Assert.Null(kind);
        }

        [Fact]
        public void KindFor_AcceptedWithoutAssistanceRecorded_IsNotAnAbsence()
        {
            var kind = LeagueAbsenceClassifier.KindFor(null, AcceptedStatusId, null);

            Assert.Null(kind);
        }

        [Fact]
        public void ReasonFor_KnownExcuse_ReturnsItsSpanishName()
        {
            Assert.Equal("Evento familiar", LeagueAbsenceClassifier.ReasonFor(ExcuseTypes.FamilyEvent.Id));
        }

        [Fact]
        public void ReasonFor_NoExcuse_IsNull()
        {
            Assert.Null(LeagueAbsenceClassifier.ReasonFor(null));
        }

        public static TheoryData<int> AbsenceAssistanceTypeIds() => new()
        {
            AssistanceType.ExcusedAbsence.Id,
            AssistanceType.UnexcusedAbsence.Id
        };
    }
}
