#nullable enable
using FluentValidation;
using RFFM.Api.Domain;
using RFFM.Api.Features.Coaches.Users.Commands;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class CreateUserValidatorTests
    {
        private readonly CreateUser.Validator _validator = new();

        [Fact]
        public void Validate_WithEmptyAccountType_ShouldFail()
        {
            // Arrange
            var command = new CreateUser.Command
            {
                Alias = "test",
                Email = "test@example.com",
                Password = "Pass123!",
                AccountType = ""
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == "AccountType");
        }

        [Fact]
        public void Validate_WithUnknownAccountType_ShouldFail()
        {
            // Arrange
            var command = new CreateUser.Command
            {
                Alias = "test",
                Email = "test@example.com",
                Password = "Pass123!",
                AccountType = "UnknownRole"
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == "AccountType");
        }

        [Fact]
        public void Validate_WithAdministratorAccountType_ShouldFail()
        {
            // Arrange
            var command = new CreateUser.Command
            {
                Alias = "test",
                Email = "test@example.com",
                Password = "Pass123!",
                AccountType = "Administrator"
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == "AccountType");
        }

        [Fact]
        public void Validate_WithFederationAccountType_ShouldFail()
        {
            // Arrange
            var command = new CreateUser.Command
            {
                Alias = "test",
                Email = "test@example.com",
                Password = "Pass123!",
                AccountType = "Federation"
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == "AccountType");
        }

        [Fact]
        public void Validate_ClubDirector_WithoutTrialAccepted_ShouldFail()
        {
            // Arrange
            var command = new CreateUser.Command
            {
                Alias = "director",
                Email = "director@example.com",
                Password = "Pass123!",
                AccountType = "ClubDirector",
                TrialAccepted = false
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == "TrialAccepted");
        }

        [Fact]
        public void Validate_ClubDirector_WithTrialAccepted_ShouldSucceed()
        {
            // Arrange
            var command = new CreateUser.Command
            {
                Alias = "director",
                Email = "director@example.com",
                Password = "Pass123!",
                AccountType = "ClubDirector",
                TrialAccepted = true
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            Assert.True(result.IsValid);
        }

        [Fact]
        public void Validate_Coach_WithoutCode_AndWithoutTrialAccepted_ShouldFail()
        {
            // Arrange
            var command = new CreateUser.Command
            {
                Alias = "coach",
                Email = "coach@example.com",
                Password = "Pass123!",
                AccountType = "Coach",
                TrialAccepted = false
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == "TrialAccepted");
        }

        [Fact]
        public void Validate_Coach_WithoutCode_AndWithTrialAccepted_ShouldSucceed()
        {
            // Arrange
            var command = new CreateUser.Command
            {
                Alias = "coach",
                Email = "coach@example.com",
                Password = "Pass123!",
                AccountType = "Coach",
                TrialAccepted = true
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            Assert.True(result.IsValid);
        }

        [Fact]
        public void Validate_Coach_WithCode_WithoutTrialAcceptedRequirement_ShouldSucceed()
        {
            // Arrange
            var command = new CreateUser.Command
            {
                Alias = "coach",
                Email = "coach@example.com",
                Password = "Pass123!",
                AccountType = "Coach",
                ClubInvitationCode = "SOMEDBOD"
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            Assert.True(result.IsValid);
        }

        [Fact]
        public void Validate_Coach_WithCode_EmptyCode_ShouldFail()
        {
            // Arrange
            var command = new CreateUser.Command
            {
                Alias = "coach",
                Email = "coach@example.com",
                Password = "Pass123!",
                AccountType = "Coach",
                ClubInvitationCode = ""
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            // Empty code with Coach should require trial
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_ClubMember_WithoutCode_ShouldFail()
        {
            // Arrange
            var command = new CreateUser.Command
            {
                Alias = "member",
                Email = "member@example.com",
                Password = "Pass123!",
                AccountType = "ClubMember"
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == "ClubInvitationCode");
        }

        [Fact]
        public void Validate_ClubMember_WithCode_ShouldSucceed()
        {
            // Arrange
            var command = new CreateUser.Command
            {
                Alias = "member",
                Email = "member@example.com",
                Password = "Pass123!",
                AccountType = "ClubMember",
                ClubInvitationCode = "MEMBERCODE"
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            Assert.True(result.IsValid);
        }

        [Fact]
        public void Validate_Player_WithoutTeamCode_ShouldFail()
        {
            // Arrange
            var command = new CreateUser.Command
            {
                Alias = "player",
                Email = "player@example.com",
                Password = "Pass123!",
                AccountType = "Player"
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == "TeamInvitationCode");
        }

        [Fact]
        public void Validate_Player_WithoutTeamPlayerId_ShouldFail()
        {
            // Arrange
            var command = new CreateUser.Command
            {
                Alias = "player",
                Email = "player@example.com",
                Password = "Pass123!",
                AccountType = "Player",
                TeamInvitationCode = "TEAMCODE"
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == "TeamPlayerId");
        }

        [Fact]
        public void Validate_Player_WithBothTeamCodeAndTeamPlayerId_ShouldSucceed()
        {
            // Arrange
            var command = new CreateUser.Command
            {
                Alias = "player",
                Email = "player@example.com",
                Password = "Pass123!",
                AccountType = "Player",
                TeamInvitationCode = "TEAMCODE",
                TeamPlayerId = "tp-123"
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            Assert.True(result.IsValid);
        }

        [Fact]
        public void Validate_FamilyMember_RequiresBothTeamCodeAndTeamPlayerId()
        {
            // Arrange
            var command = new CreateUser.Command
            {
                Alias = "family",
                Email = "family@example.com",
                Password = "Pass123!",
                AccountType = "FamilyMember",
                TeamInvitationCode = "TEAMCODE"
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == "TeamPlayerId");
        }

        [Fact]
        public void Validate_FamilyMember_WithBothTeamCodeAndTeamPlayerId_ShouldSucceed()
        {
            // Arrange
            var command = new CreateUser.Command
            {
                Alias = "family",
                Email = "family@example.com",
                Password = "Pass123!",
                AccountType = "FamilyMember",
                TeamInvitationCode = "TEAMCODE",
                TeamPlayerId = "tp-456"
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            Assert.True(result.IsValid);
        }

        [Fact]
        public void Validate_Fan_RequiresOnlyBasicFields()
        {
            // Arrange
            var command = new CreateUser.Command
            {
                Alias = "fan",
                Email = "fan@example.com",
                Password = "Pass123!",
                AccountType = "Fan"
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            Assert.True(result.IsValid);
        }
    }
}
