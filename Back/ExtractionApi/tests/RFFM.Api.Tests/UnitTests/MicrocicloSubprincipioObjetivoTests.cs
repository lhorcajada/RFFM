#nullable enable
using System.Collections.Generic;
using RFFM.Api.Domain.Aggregates.SeasonPlans;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class MicrocicloSubprincipioObjetivoTests
    {
        [Fact]
        public void Create_WithValidIds_SetsProperties()
        {
            var target = new MicrocicloSubprincipioObjetivo("microciclo-1", "sub-1");

            Assert.Equal("microciclo-1", target.MicrocicloId);
            Assert.Equal("sub-1", target.SubprincipioId);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptyMicrocicloId_Throws(string? microcicloId)
        {
            Assert.Throws<System.ArgumentException>(() => new MicrocicloSubprincipioObjetivo(microcicloId!, "sub-1"));
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptySubprincipioId_Throws(string? subprincipioId)
        {
            Assert.Throws<System.ArgumentException>(() => new MicrocicloSubprincipioObjetivo("microciclo-1", subprincipioId!));
        }
    }

    public class MicrocicloSubprincipiosObjetivoReplaceTests
    {
        private static Microciclo NewMicrociclo() =>
            new("mesociclo-1", 1, "Semana 1", new System.DateOnly(2026, 9, 1), new System.DateOnly(2026, 9, 7));

        [Fact]
        public void ReplaceSubprincipiosObjetivo_WithIds_AddsThem()
        {
            var microciclo = NewMicrociclo();

            microciclo.ReplaceSubprincipiosObjetivo(new List<string> { "sub-1", "sub-2" });

            Assert.Equal(2, microciclo.SubprincipiosObjetivo.Count);
            Assert.Contains(microciclo.SubprincipiosObjetivo, s => s.SubprincipioId == "sub-1");
            Assert.Contains(microciclo.SubprincipiosObjetivo, s => s.SubprincipioId == "sub-2");
            Assert.All(microciclo.SubprincipiosObjetivo, s => Assert.Equal(microciclo.Id, s.MicrocicloId));
        }

        [Fact]
        public void ReplaceSubprincipiosObjetivo_CalledAgain_ClearsAndRebuilds()
        {
            var microciclo = NewMicrociclo();
            microciclo.ReplaceSubprincipiosObjetivo(new List<string> { "sub-1" });

            microciclo.ReplaceSubprincipiosObjetivo(new List<string> { "sub-2", "sub-3" });

            Assert.Equal(2, microciclo.SubprincipiosObjetivo.Count);
            Assert.DoesNotContain(microciclo.SubprincipiosObjetivo, s => s.SubprincipioId == "sub-1");
        }

        [Fact]
        public void ReplaceSubprincipiosObjetivo_WithDuplicateIds_Dedupes()
        {
            var microciclo = NewMicrociclo();

            microciclo.ReplaceSubprincipiosObjetivo(new List<string> { "sub-1", "sub-1", "sub-2" });

            Assert.Equal(2, microciclo.SubprincipiosObjetivo.Count);
        }

        [Fact]
        public void ReplaceSubprincipiosObjetivo_WithNull_ClearsToEmpty()
        {
            var microciclo = NewMicrociclo();
            microciclo.ReplaceSubprincipiosObjetivo(new List<string> { "sub-1" });

            microciclo.ReplaceSubprincipiosObjetivo(null);

            Assert.Empty(microciclo.SubprincipiosObjetivo);
        }

        [Fact]
        public void ReplaceSubprincipiosObjetivo_WithEmptyList_ClearsToEmpty()
        {
            var microciclo = NewMicrociclo();
            microciclo.ReplaceSubprincipiosObjetivo(new List<string> { "sub-1" });

            microciclo.ReplaceSubprincipiosObjetivo(new List<string>());

            Assert.Empty(microciclo.SubprincipiosObjetivo);
        }
    }
}
