#nullable enable
using RFFM.Api.Domain.Aggregates.UserClubs;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class SpaceTypeTests
    {
        [Fact]
        public void New_club_without_explicit_type_is_personal_space()
        {
            var club = Club.Create("Espacio Personal Sin Tipo", 1);

            Assert.Equal(SpaceType.PersonalSpace, club.SpaceType);
        }

        [Fact]
        public void New_club_with_explicit_club_type_keeps_club_type()
        {
            var club = Club.Create("Club Con Tipo Explicito", 1, spaceType: SpaceType.Club);

            Assert.Equal(SpaceType.Club, club.SpaceType);
        }

        [Fact]
        public void Personal_space_label_is_espacio_personal()
        {
            Assert.Equal("Espacio personal", SpaceType.PersonalSpace.Label);
        }

        [Fact]
        public void Club_label_is_club()
        {
            Assert.Equal("Club", SpaceType.Club.Label);
        }
    }
}
