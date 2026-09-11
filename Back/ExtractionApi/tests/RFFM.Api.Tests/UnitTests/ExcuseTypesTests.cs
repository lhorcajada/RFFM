#nullable enable
using RFFM.Api.Domain.Aggregates.Assistances;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Covers the new "Sanción deportiva" excuse type (id 8, design.md Decisión 6).
    /// </summary>
    public class ExcuseTypesTests
    {
        [Fact]
        public void List_IncludesSportiveSanction()
        {
            Assert.Contains(ExcuseTypes.List(), e => e.Id == 8 && e.Name == "Sanción deportiva");
        }

        [Fact]
        public void FromId_Eight_ResolvesSportiveSanction()
        {
            var excuse = ExcuseTypes.FromId(8);

            Assert.NotNull(excuse);
            Assert.Equal("Sanción deportiva", excuse!.Name);
            Assert.True(excuse.Justified);
        }
    }
}
