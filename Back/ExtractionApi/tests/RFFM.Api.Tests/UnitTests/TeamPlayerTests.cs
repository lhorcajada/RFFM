#nullable enable
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class TeamPlayerTests
    {
        private static TeamPlayer CreateTeamPlayer(ContactModel? contactInfo = null)
        {
            return TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = Guid.NewGuid().ToString(),
                TeamId = Guid.NewGuid().ToString(),
                SeasonId = Guid.NewGuid().ToString(),
                JoinedDate = DateTime.UtcNow,
                ContactInfo = contactInfo,
                FamilyMembers = new List<FamilyModel>()
            });
        }

        [Fact]
        public void UpdateContactEmail_SetsEmail_PreservingAddressAndPhone()
        {
            var teamPlayer = CreateTeamPlayer(new ContactModel
            {
                Phone = "600123456",
                Email = "old@rffm.test",
                Address = new AddressModel { Street = "Calle Falsa 123", City = "Madrid" }
            });

            teamPlayer.UpdateContactEmail("new@rffm.test");

            Assert.Equal("new@rffm.test", teamPlayer.ContactInfo!.Email);
            Assert.Equal("600123456", teamPlayer.ContactInfo!.Phone);
            Assert.NotNull(teamPlayer.ContactInfo!.Address);
            Assert.Equal("Calle Falsa 123", teamPlayer.ContactInfo!.Address!.Street);
            Assert.Equal("Madrid", teamPlayer.ContactInfo!.Address!.City);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void UpdateContactEmail_WithEmptyOrNullEmail_DoesNothing(string? email)
        {
            var teamPlayer = CreateTeamPlayer(new ContactModel
            {
                Phone = "600123456",
                Email = "old@rffm.test"
            });

            teamPlayer.UpdateContactEmail(email!);

            Assert.Equal("old@rffm.test", teamPlayer.ContactInfo!.Email);
            Assert.Equal("600123456", teamPlayer.ContactInfo!.Phone);
        }

        [Fact]
        public void AddFamilyMemberEmailIfMissing_WhenEmailNotPresent_AddsNewFamilyEntry()
        {
            var teamPlayer = CreateTeamPlayer();

            var result = teamPlayer.AddFamilyMemberEmailIfMissing("family@rffm.test");

            Assert.True(result);
            Assert.Single(teamPlayer.FamilyMembers);
            Assert.Equal("family@rffm.test", teamPlayer.FamilyMembers[0].Email);
        }

        [Fact]
        public void AddFamilyMemberEmailIfMissing_WhenEmailAlreadyPresent_CaseInsensitive_DoesNotDuplicate()
        {
            var teamPlayer = CreateTeamPlayer();
            teamPlayer.AddFamilyMemberEmailIfMissing("Family@rffm.test");

            var result = teamPlayer.AddFamilyMemberEmailIfMissing("family@RFFM.test");

            Assert.False(result);
            Assert.Single(teamPlayer.FamilyMembers);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void AddFamilyMemberEmailIfMissing_WithEmptyOrNullEmail_DoesNothingAndReturnsFalse(string? email)
        {
            var teamPlayer = CreateTeamPlayer();

            var result = teamPlayer.AddFamilyMemberEmailIfMissing(email!);

            Assert.False(result);
            Assert.Empty(teamPlayer.FamilyMembers);
        }
    }
}
