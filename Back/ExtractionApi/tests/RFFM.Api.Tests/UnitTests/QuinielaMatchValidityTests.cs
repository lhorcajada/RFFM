using RFFM.Api.Domain.Entities.Teams;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class QuinielaMatchValidityTests
    {
        [Fact]
        public void ScheduledMatch_IsValid() =>
            Assert.True(QuinielaMatchValidity.IsValid("", "", ""));

        [Fact]
        public void FinishedMatch_IsValid() =>
            Assert.True(QuinielaMatchValidity.IsValid("1", "", "Normal"));

        [Fact]
        public void SuspendedStatus_IsNotValid() =>
            Assert.False(QuinielaMatchValidity.IsValid("3", "", ""));

        [Theory]
        [InlineData("Aplazado por inclemencias")]
        [InlineData("PARTIDO APLAZADO")]
        public void PostponedReason_IsNotValid(string reason) =>
            Assert.False(QuinielaMatchValidity.IsValid("", reason, ""));

        [Fact]
        public void PostponedGameSituation_IsNotValid() =>
            Assert.False(QuinielaMatchValidity.IsValid("", "", "Aplazado"));

        [Fact]
        public void SuspendedReason_IsNotValid() =>
            Assert.False(QuinielaMatchValidity.IsValid("", "Suspendido por lluvia", ""));
    }
}
