#nullable enable
using RFFM.Api.Domain.Entities.TeamPlayers;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class TeamPlayerFamilyMemberTests
    {
        [Fact]
        public void Create_WithValidData_AssignsNonEmptyId()
        {
            var teamPlayerId = Guid.NewGuid().ToString();

            var familyMember = TeamPlayerFamilyMember.Create(
                teamPlayerId, "Jane", "Doe", "600123456", "jane@rffm.test", "12345678A", "Mother");

            Assert.False(string.IsNullOrWhiteSpace(familyMember.Id));
            Assert.Equal(teamPlayerId, familyMember.TeamPlayerId);
            Assert.Equal("Jane", familyMember.Name);
            Assert.Equal("Doe", familyMember.LastName);
            Assert.Equal("600123456", familyMember.Phone);
            Assert.Equal("jane@rffm.test", familyMember.Email);
            Assert.Equal("12345678A", familyMember.Dni);
            Assert.Equal("Mother", familyMember.FamilyMember);
        }

        [Fact]
        public void Create_WithOnlyEmail_AllowsNullNameAndRelation()
        {
            var teamPlayerId = Guid.NewGuid().ToString();

            var familyMember = TeamPlayerFamilyMember.Create(
                teamPlayerId, name: null, lastName: null, phone: null,
                email: "family@rffm.test", dni: null, familyMember: null);

            Assert.False(string.IsNullOrWhiteSpace(familyMember.Id));
            Assert.Null(familyMember.Name);
            Assert.Null(familyMember.LastName);
            Assert.Null(familyMember.FamilyMember);
            Assert.Equal("family@rffm.test", familyMember.Email);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void Create_WithoutTeamPlayerId_Throws(string? teamPlayerId)
        {
            Assert.Throws<ArgumentException>(() =>
                TeamPlayerFamilyMember.Create(teamPlayerId!, "Jane", "Doe", null, null, null, null));
        }

        [Fact]
        public void UpdateDetails_ReplacesAllMutableFields()
        {
            var teamPlayerId = Guid.NewGuid().ToString();
            var familyMember = TeamPlayerFamilyMember.Create(
                teamPlayerId, "Jane", "Doe", "600123456", "jane@rffm.test", "12345678A", "Mother");

            familyMember.UpdateDetails("John", "Smith", "600999888", "john@rffm.test", "87654321B", "Father", null);

            Assert.Equal("John", familyMember.Name);
            Assert.Equal("Smith", familyMember.LastName);
            Assert.Equal("600999888", familyMember.Phone);
            Assert.Equal("john@rffm.test", familyMember.Email);
            Assert.Equal("87654321B", familyMember.Dni);
            Assert.Equal("Father", familyMember.FamilyMember);
        }
    }
}
