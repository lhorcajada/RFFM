#nullable enable
using RFFM.Api.Features.Coaches.Users.Commands;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class UpdateMyPersonalDataValidatorTests
    {
        private static UpdateMyPersonalData.Command Command(
            string firstName = "Ana", string lastName = "García", string? secondLastName = null, string? phone = null) =>
            new() { UserId = "user-1", FirstName = firstName, LastName = lastName, SecondLastName = secondLastName, PhoneNumber = phone };

        private static bool IsValid(UpdateMyPersonalData.Command command) =>
            new UpdateMyPersonalData.Validator().Validate(command).IsValid;

        [Fact]
        public void Validate_RequiredFieldsOnly_IsValid()
        {
            Assert.True(IsValid(Command()));
        }

        [Fact]
        public void Validate_AllFields_IsValid()
        {
            Assert.True(IsValid(Command(secondLastName: "López", phone: "+34 600 000 000")));
        }

        [Theory]
        [InlineData("", "García")]
        [InlineData("Ana", "")]
        [InlineData("  ", "García")]
        public void Validate_MissingFirstNameOrLastName_IsInvalid(string firstName, string lastName)
        {
            Assert.False(IsValid(Command(firstName, lastName)));
        }

        [Fact]
        public void Validate_NameOver50Chars_IsInvalid()
        {
            Assert.False(IsValid(Command(firstName: new string('a', 51))));
        }

        [Fact]
        public void Validate_SecondLastNameOver50Chars_IsInvalid()
        {
            Assert.False(IsValid(Command(secondLastName: new string('a', 51))));
        }

        [Theory]
        [InlineData("600")]
        [InlineData("teléfono")]
        [InlineData("+34-600-000-000")]
        public void Validate_InvalidPhone_IsInvalid(string phone)
        {
            Assert.False(IsValid(Command(phone: phone)));
        }

        [Fact]
        public void Validate_EmptyPhone_IsValid()
        {
            Assert.True(IsValid(Command(phone: "")));
        }
    }
}
