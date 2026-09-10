#nullable enable
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Models;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Pure domain tests for Convocation.SetMinutesReason — the free-text, optional field
    /// used to explain why a convocated player is planned to play fewer minutes than other
    /// convocated players (design.md, add-match-minutes-reason-note).
    /// </summary>
    public class ConvocationMinutesReasonTests
    {
        private static Convocation CreateConvocation() => Convocation.Create(new ConvocationModel
        {
            EventId = "event-1",
            TeamPlayerId = "player-1",
            AssistanceTypeId = null,
            ConvocationStatusId = 1,
            ExcuseTypeId = null
        });

        [Fact]
        public void SetMinutesReason_WithText_SetsTrimmedValue()
        {
            var convocation = CreateConvocation();

            convocation.SetMinutesReason("  Portero suplente esta semana  ");

            Assert.Equal("Portero suplente esta semana", convocation.MinutesReason);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void SetMinutesReason_WithBlankValue_ClearsField(string? blank)
        {
            var convocation = CreateConvocation();
            convocation.SetMinutesReason("Motivo inicial");

            convocation.SetMinutesReason(blank);

            Assert.Null(convocation.MinutesReason);
        }

        [Fact]
        public void SetMinutesReason_ExceedingMaxLength_Throws()
        {
            var convocation = CreateConvocation();
            var tooLong = new string('a', 501);

            Assert.Throws<ArgumentException>(() => convocation.SetMinutesReason(tooLong));
        }

        [Fact]
        public void SetMinutesReason_AtMaxLength_Succeeds()
        {
            var convocation = CreateConvocation();
            var exactly500 = new string('a', 500);

            convocation.SetMinutesReason(exactly500);

            Assert.Equal(exactly500, convocation.MinutesReason);
        }

        [Fact]
        public void NewConvocation_HasNoMinutesReasonByDefault()
        {
            var convocation = CreateConvocation();

            Assert.Null(convocation.MinutesReason);
        }
    }
}
