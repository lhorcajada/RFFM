using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Features.Coaches.Players.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class FormStatusOutcomeTests
    {
        private static readonly int DeconvokeId = ConvocationStatus.FromName("Deconvoke").Id;
        private static readonly int JustifiedId = ConvocationStatus.FromName("Justified").Id;
        private const int InjuryExcuse = 1;
        private const int TechnicalDecisionExcuse = 7;

        [Fact]
        public void InjuryExcuse_IsAbsent_EvenWithAttendance()
        {
            Assert.Equal(ParticipationOutcome.Absent, FormStatusOutcome.Classify(AssistanceType.Attendance.Id, null, InjuryExcuse));
        }

        [Fact]
        public void TechnicalDecisionExcuse_IsExcluded()
        {
            Assert.Equal(ParticipationOutcome.Excluded, FormStatusOutcome.Classify(null, null, TechnicalDecisionExcuse));
        }

        [Theory]
        [MemberData(nameof(AttendedAssistances))]
        public void AttendanceOrLateArrival_IsAttended(int assistanceTypeId)
        {
            Assert.Equal(ParticipationOutcome.Attended, FormStatusOutcome.Classify(assistanceTypeId, null, null));
        }

        public static IEnumerable<object[]> AttendedAssistances() => new[]
        {
            new object[] { AssistanceType.Attendance.Id },
            new object[] { AssistanceType.LateArrival.Id },
        };

        [Theory]
        [MemberData(nameof(AbsentAssistances))]
        public void UnexcusedOrExcusedAbsence_IsAbsent(int assistanceTypeId)
        {
            Assert.Equal(ParticipationOutcome.Absent, FormStatusOutcome.Classify(assistanceTypeId, null, null));
        }

        public static IEnumerable<object[]> AbsentAssistances() => new[]
        {
            new object[] { AssistanceType.UnexcusedAbsence.Id },
            new object[] { AssistanceType.ExcusedAbsence.Id },
        };

        // Enmienda: alineado con AttributableAbsenceCalculator, un deconvocado sin asistencia y sin
        // motivo de decision tecnica es una falta imputable (antes se excluia).
        [Fact]
        public void DeconvokeWithoutAssistance_IsAbsent()
        {
            Assert.Equal(ParticipationOutcome.Absent, FormStatusOutcome.Classify(null, DeconvokeId, null));
        }

        [Fact]
        public void DeconvokeWithoutAssistance_ForTechnicalDecision_IsExcluded()
        {
            Assert.Equal(ParticipationOutcome.Excluded, FormStatusOutcome.Classify(null, DeconvokeId, TechnicalDecisionExcuse));
        }

        [Fact]
        public void JustifiedWithoutAssistance_IsAbsent()
        {
            Assert.Equal(ParticipationOutcome.Absent, FormStatusOutcome.Classify(null, JustifiedId, null));
        }

        [Fact]
        public void PendingWithoutResult_IsExcluded()
        {
            Assert.Equal(ParticipationOutcome.Excluded, FormStatusOutcome.Classify(null, ConvocationStatus.FromName("Pending").Id, null));
        }
    }
}
