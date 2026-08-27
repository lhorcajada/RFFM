using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Models;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class PlayerMedicalHistoryTests
    {
        private static Player CreatePlayer() => Player.Create(new PlayerModelBase
        {
            Name = "Test",
            LastName = "Player",
            Alias = $"testplayer-{System.Guid.NewGuid():N}",
            ClubId = "club-1",
        });

        [Fact]
        public void Create_WithMedicalAndProvenanceFields_StoresThem()
        {
            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test",
                LastName = "Player",
                Alias = $"testplayer-{System.Guid.NewGuid():N}",
                ClubId = "club-1",
                Enfermedades = "Asma",
                Alergias = "Frutos secos",
                Procedencia = "FEPE Getafe III",
            });

            Assert.Equal("Asma", player.Enfermedades);
            Assert.Equal("Frutos secos", player.Alergias);
            Assert.Equal("FEPE Getafe III", player.Procedencia);
        }

        [Fact]
        public void UpdateEnfermedades_SetsValue()
        {
            var player = CreatePlayer();

            player.UpdateEnfermedades("Diabetes tipo 1");

            Assert.Equal("Diabetes tipo 1", player.Enfermedades);
        }

        [Fact]
        public void UpdateAlergias_SetsValue()
        {
            var player = CreatePlayer();

            player.UpdateAlergias("Polen");

            Assert.Equal("Polen", player.Alergias);
        }

        [Fact]
        public void UpdateProcedencia_SetsValue()
        {
            var player = CreatePlayer();

            player.UpdateProcedencia("ADC Brunete");

            Assert.Equal("ADC Brunete", player.Procedencia);
        }

        [Fact]
        public void UpdateEnfermedades_WithTooLongValue_Throws()
        {
            var player = CreatePlayer();
            var tooLong = new string('a', ValidationConstants.PlayerEnfermedadesMaxLength + 1);

            Assert.Throws<System.ArgumentOutOfRangeException>(() => player.UpdateEnfermedades(tooLong));
        }

        [Fact]
        public void UpdateProcedencia_WithTooLongValue_Throws()
        {
            var player = CreatePlayer();
            var tooLong = new string('a', ValidationConstants.PlayerProcedenciaMaxLength + 1);

            Assert.Throws<System.ArgumentOutOfRangeException>(() => player.UpdateProcedencia(tooLong));
        }
    }
}
