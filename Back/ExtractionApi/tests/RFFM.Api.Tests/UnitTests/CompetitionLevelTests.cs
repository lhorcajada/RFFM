using RFFM.Api.Domain.Services.MatchSimulation;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class CompetitionLevelTests
    {
        [Theory]
        [InlineData("TERCERA INFANTIL", 0)]
        [InlineData("SEGUNDA INFANTIL ", 1)]
        [InlineData("PRIMERA INFANTIL", 2)]
        [InlineData("PREFERENTE CADETE", 3)]
        [InlineData("PRIMERA DIVISIÓN AUTONÓMICA CADETE", 4)]
        [InlineData("primera division autonomica juvenil", 4)]
        [InlineData("DIVISIÓN DE HONOR JUVENIL", 5)]
        [InlineData("SUPERLIGA CADETE", 6)]
        public void Reconoce_la_division(string competition, int expected)
        {
            Assert.Equal(expected, CompetitionLevel.Division(competition));
        }

        [Theory]
        [InlineData("SEGUNDA PREBENJAMÍN", 0)]
        [InlineData("SEGUNDA BENJAMIN", 1)]
        [InlineData("PRIMERA ALEVÍN", 2)]
        [InlineData("PRIMERA INFANTIL", 3)]
        [InlineData("SEGUNDA CADETE", 4)]
        [InlineData("SEGUNDA JUVENIL", 5)]
        [InlineData("PRIMERA AFICIONADO", 6)]
        public void Reconoce_la_categoria_de_edad(string competition, int expected)
        {
            Assert.Equal(expected, CompetitionLevel.AgeCategory(competition));
        }

        [Fact]
        public void Primera_esta_un_nivel_por_encima_de_segunda()
        {
            Assert.Equal(CompetitionLevel.Level("SEGUNDA INFANTIL") + 1, CompetitionLevel.Level("PRIMERA INFANTIL"));
        }

        [Fact]
        public void Una_categoria_de_edad_mas_equivale_a_una_division_mas()
        {
            Assert.Equal(CompetitionLevel.Level("PRIMERA INFANTIL"), CompetitionLevel.Level("SEGUNDA CADETE"));
        }

        [Fact]
        public void Sin_division_reconocible_no_hay_nivel()
        {
            Assert.Null(CompetitionLevel.Division("COPA PRIMAVERA"));
            Assert.Null(CompetitionLevel.Level("COPA PRIMAVERA INFANTIL"));
        }

        [Fact]
        public void Sin_categoria_de_edad_el_nivel_es_solo_la_division()
        {
            Assert.Null(CompetitionLevel.AgeCategory("PRIMERA"));
            Assert.Equal(2, CompetitionLevel.Level("PRIMERA"));
        }
    }
}
