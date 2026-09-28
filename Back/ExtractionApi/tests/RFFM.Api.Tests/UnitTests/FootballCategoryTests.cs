using RFFM.Api.Domain.Entities.Federation.SquadHistory;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class FootballCategoryTests
    {
        private const int Season2026 = 2026;

        [Theory]
        [InlineData("Alevin", 2015, 2016)]
        [InlineData("Infantil", 2013, 2014)]
        [InlineData("Cadete", 2011, 2012)]
        [InlineData("Juvenil", 2008, 2010)]
        public void Anios_de_nacimiento_por_categoria_en_2026_2027(string category, int from, int to)
        {
            var sut = FootballCategory.FromName(category);

            Assert.True(sut.IncludesBirthYear(from, Season2026));
            Assert.True(sut.IncludesBirthYear(to, Season2026));
            Assert.False(sut.IncludesBirthYear(from - 1, Season2026));
            Assert.False(sut.IncludesBirthYear(to + 1, Season2026));
        }

        [Fact]
        public void Senior_son_los_nacidos_en_2007_o_antes()
        {
            Assert.True(FootballCategory.Senior.IncludesBirthYear(2007, Season2026));
            Assert.True(FootballCategory.Senior.IncludesBirthYear(1990, Season2026));
            Assert.False(FootballCategory.Senior.IncludesBirthYear(2008, Season2026));
        }

        [Fact]
        public void Los_anios_se_desplazan_con_la_temporada()
        {
            Assert.True(FootballCategory.Cadete.IncludesBirthYear(2010, 2025));
            Assert.False(FootballCategory.Cadete.IncludesBirthYear(2012, 2025));
        }

        [Fact]
        public void Categorias_origen_incluyen_la_propia_y_la_inferior()
        {
            Assert.Equal(new[] { FootballCategory.Cadete, FootballCategory.Infantil }, FootballCategory.Cadete.CandidateSources);
            Assert.Equal(new[] { FootballCategory.Infantil, FootballCategory.Alevin }, FootballCategory.Infantil.CandidateSources);
            Assert.Equal(new[] { FootballCategory.Juvenil, FootballCategory.Cadete }, FootballCategory.Juvenil.CandidateSources);
            Assert.Equal(new[] { FootballCategory.Senior, FootballCategory.Juvenil }, FootballCategory.Senior.CandidateSources);
            Assert.Equal(new[] { FootballCategory.Alevin }, FootballCategory.Alevin.CandidateSources);
        }

        [Theory]
        [InlineData("PRIMERA CADETE", "Cadete")]
        [InlineData("Infantil Preferente", "Infantil")]
        [InlineData("SEGUNDA ALEVÍN F-7", "Alevin")]
        [InlineData("DIVISION DE HONOR JUVENIL", "Juvenil")]
        [InlineData("PREFERENTE FEMENINO CADETE", "Cadete")]
        [InlineData("TERCERA DIVISION", "Senior")]
        [InlineData("AFICIONADOS", "Senior")]
        public void Detecta_la_categoria_por_texto(string text, string expected)
        {
            Assert.True(FootballCategory.TryDetect(text, out var category));
            Assert.Equal(expected, category!.Name);
        }

        [Theory]
        [InlineData("BENJAMIN F-7")]
        [InlineData("PREBENJAMÍN")]
        [InlineData("VETERANOS")]
        [InlineData("")]
        [InlineData(null)]
        public void No_soporta_categorias_fuera_de_la_regla(string? text)
        {
            Assert.False(FootballCategory.TryDetect(text, out _));
        }

        [Theory]
        [InlineData("PREFERENTE FEMENINO CADETE", true)]
        [InlineData("FÚTBOL FEMENINO", true)]
        [InlineData("PRIMERA CADETE", false)]
        public void Detecta_futbol_femenino(string text, bool expected)
        {
            Assert.Equal(expected, FootballCategory.IsFemale(text));
        }

        [Theory]
        [InlineData("2026-2027", 2026)]
        [InlineData("2025/26", 2025)]
        public void Obtiene_el_anio_de_inicio_de_la_temporada(string label, int expected)
        {
            Assert.Equal(expected, FootballCategory.SeasonStartYear(label));
        }

        [Fact]
        public void Etiqueta_de_temporada_invalida_devuelve_null()
        {
            Assert.Null(FootballCategory.SeasonStartYear("temporada"));
        }
    }
}
