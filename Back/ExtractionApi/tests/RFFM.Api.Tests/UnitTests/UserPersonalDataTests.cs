#nullable enable
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class UserPersonalDataTests
    {
        [Fact]
        public void Create_TrimsValuesAndStoresEmptyOptionalsAsNull()
        {
            var data = UserPersonalData.Create("user-1", "  Ana ", " García ", "   ", "");

            Assert.Equal("user-1", data.ApplicationUserId);
            Assert.Equal("Ana", data.FirstName);
            Assert.Equal("García", data.LastName);
            Assert.Null(data.SecondLastName);
            Assert.Null(data.PhoneNumber);
            Assert.Null(data.AvatarUrl);
        }

        [Theory]
        [InlineData("", "García")]
        [InlineData("Ana", "  ")]
        public void Create_WithoutFirstNameOrLastName_Throws(string firstName, string lastName)
        {
            var ex = Assert.Throws<DomainException>(() => UserPersonalData.Create("user-1", firstName, lastName, null, null));

            Assert.Equal(ErrorCodes.PersonalDataNameRequired, ex.Code);
        }

        [Fact]
        public void Create_WithoutUser_Throws()
        {
            var ex = Assert.Throws<DomainException>(() => UserPersonalData.Create(" ", "Ana", "García", null, null));

            Assert.Equal(ErrorCodes.MissingRequiredArgument, ex.Code);
        }

        [Fact]
        public void Update_ChangesFieldsAndUpdatedAt()
        {
            var data = UserPersonalData.Create("user-1", "Ana", "García", null, null);
            var before = data.UpdatedAt;

            data.Update("Ana María", "García", " López ", "+34 600 000 000");

            Assert.Equal("Ana María", data.FirstName);
            Assert.Equal("López", data.SecondLastName);
            Assert.Equal("+34 600 000 000", data.PhoneNumber);
            Assert.True(data.UpdatedAt >= before);
        }

        [Fact]
        public void Update_WithoutFirstName_Throws()
        {
            var data = UserPersonalData.Create("user-1", "Ana", "García", null, null);

            var ex = Assert.Throws<DomainException>(() => data.Update("", "García", null, null));

            Assert.Equal(ErrorCodes.PersonalDataNameRequired, ex.Code);
        }

        [Fact]
        public void SetAvatar_StoresUrl()
        {
            var data = UserPersonalData.Create("user-1", "Ana", "García", null, null);

            data.SetAvatar("https://storage/avatars/user-1/a.png");

            Assert.Equal("https://storage/avatars/user-1/a.png", data.AvatarUrl);
        }

        [Fact]
        public void RemoveAvatar_ClearsUrlAndReturnsPrevious()
        {
            var data = UserPersonalData.Create("user-1", "Ana", "García", null, null);
            data.SetAvatar("https://storage/avatars/user-1/a.png");

            var previous = data.RemoveAvatar();

            Assert.Equal("https://storage/avatars/user-1/a.png", previous);
            Assert.Null(data.AvatarUrl);
        }

        [Fact]
        public void RemoveAvatar_WithoutAvatar_ReturnsNull()
        {
            var data = UserPersonalData.Create("user-1", "Ana", "García", null, null);

            Assert.Null(data.RemoveAvatar());
        }
    }
}
