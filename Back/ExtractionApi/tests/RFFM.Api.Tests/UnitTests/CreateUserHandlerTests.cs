#nullable enable
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Features.Coaches.Users.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services.Email;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class CreateUserHandlerTests
    {
        [Fact]
        public async Task Handle_WithAlreadyRegisteredEmail_ReturnsBadRequestWithEmailIsAlreadyTakenCode_AndDoesNotCreateUser()
        {
            // Arrange
            var userManagerMock = MockUserManager();
            userManagerMock
                .Setup(m => m.FindByNameAsync(It.IsAny<string>()))
                .ReturnsAsync((IdentityUser?)null);
            userManagerMock
                .Setup(m => m.FindByEmailAsync("existing@rffm.test"))
                .ReturnsAsync(new IdentityUser { Email = "existing@rffm.test", UserName = "existing" });

            var roleManagerMock = MockRoleManager();
            var configuration = new ConfigurationBuilder().Build();
            var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql("Host=localhost;Database=rffm_test;Username=test;Password=test")
                .Options);
            var emailService = new EmailService(configuration, null!);
            var logger = NullLogger<CreateUser.Handler>.Instance;

            var handler = new CreateUser.Handler(
                userManagerMock.Object,
                roleManagerMock.Object,
                emailService,
                configuration,
                db,
                logger);

            var command = new CreateUser.Command
            {
                Alias = "newcoach",
                Email = "existing@rffm.test",
                Password = "S3cure!Pass",
                AccountType = "Coach"
            };

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status400BadRequest, statusCodeResult.StatusCode);

            var valueResult = Assert.IsAssignableFrom<IValueHttpResult<ProblemDetails>>(result);
            Assert.NotNull(valueResult.Value);
            Assert.Equal(ErrorCodes.EmailIsAlreadyTaken, valueResult.Value!.Extensions["code"]);

            userManagerMock.Verify(
                m => m.CreateAsync(It.IsAny<IdentityUser>(), It.IsAny<string>()),
                Times.Never);
        }

        [Fact]
        public async Task Handle_WithAlreadyRegisteredAlias_ReturnsConflictWithAliasIsAlreadyTakenCode_AndDoesNotCreateUser()
        {
            // Arrange
            var userManagerMock = MockUserManager();
            userManagerMock
                .Setup(m => m.FindByNameAsync("existingalias"))
                .ReturnsAsync(new IdentityUser { Email = "existing@rffm.test", UserName = "existingalias" });

            var roleManagerMock = MockRoleManager();
            var configuration = new ConfigurationBuilder().Build();
            var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql("Host=localhost;Database=rffm_test;Username=test;Password=test")
                .Options);
            var emailService = new EmailService(configuration, null!);
            var logger = NullLogger<CreateUser.Handler>.Instance;

            var handler = new CreateUser.Handler(
                userManagerMock.Object,
                roleManagerMock.Object,
                emailService,
                configuration,
                db,
                logger);

            var command = new CreateUser.Command
            {
                Alias = "existingalias",
                Email = "newcoach@rffm.test",
                Password = "S3cure!Pass",
                AccountType = "Coach"
            };

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status409Conflict, statusCodeResult.StatusCode);

            var valueResult = Assert.IsAssignableFrom<IValueHttpResult<ProblemDetails>>(result);
            Assert.NotNull(valueResult.Value);
            Assert.Equal(ErrorCodes.AliasIsAlreadyTaken, valueResult.Value!.Extensions["code"]);

            userManagerMock.Verify(
                m => m.CreateAsync(It.IsAny<IdentityUser>(), It.IsAny<string>()),
                Times.Never);
        }

        [Fact]
        public async Task Handle_WhenUserCreationFails_ReturnsBadRequestWithUserCreationFailedCode()
        {
            // Arrange
            var userManagerMock = MockUserManager();
            userManagerMock
                .Setup(m => m.FindByNameAsync(It.IsAny<string>()))
                .ReturnsAsync((IdentityUser?)null);
            userManagerMock
                .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
                .ReturnsAsync((IdentityUser?)null);
            userManagerMock
                .Setup(m => m.CreateAsync(It.IsAny<IdentityUser>(), It.IsAny<string>()))
                .ReturnsAsync(IdentityResult.Failed(new IdentityError
                {
                    Code = "DuplicateUserName",
                    Description = "Username 'newcoach' is already taken."
                }));

            var roleManagerMock = MockRoleManager();
            var configuration = new ConfigurationBuilder().Build();
            var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql("Host=localhost;Database=rffm_test;Username=test;Password=test")
                .Options);
            var emailService = new EmailService(configuration, null!);
            var logger = NullLogger<CreateUser.Handler>.Instance;

            var handler = new CreateUser.Handler(
                userManagerMock.Object,
                roleManagerMock.Object,
                emailService,
                configuration,
                db,
                logger);

            var command = new CreateUser.Command
            {
                Alias = "newcoach",
                Email = "newcoach@rffm.test",
                Password = "S3cure!Pass",
                AccountType = "Coach"
            };

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status400BadRequest, statusCodeResult.StatusCode);

            var valueResult = Assert.IsAssignableFrom<IValueHttpResult<ProblemDetails>>(result);
            Assert.NotNull(valueResult.Value);
            Assert.Equal(ErrorCodes.UserCreationFailed, valueResult.Value!.Extensions["code"]);
        }

        [Fact]
        public async Task Handle_WithMissingAccountType_ReturnsBadRequestWithAccountTypeRequiredCode()
        {
            // Arrange
            var userManagerMock = MockUserManager();
            var roleManagerMock = MockRoleManager();
            var configuration = new ConfigurationBuilder().Build();
            var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql("Host=localhost;Database=rffm_test;Username=test;Password=test")
                .Options);
            var emailService = new EmailService(configuration, null!);
            var logger = NullLogger<CreateUser.Handler>.Instance;

            var handler = new CreateUser.Handler(
                userManagerMock.Object,
                roleManagerMock.Object,
                emailService,
                configuration,
                db,
                logger);

            var command = new CreateUser.Command
            {
                Alias = "newcoach",
                Email = "someone@rffm.test",
                Password = "S3cure!Pass",
                AccountType = null
            };

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status400BadRequest, statusCodeResult.StatusCode);

            var valueResult = Assert.IsAssignableFrom<IValueHttpResult<ProblemDetails>>(result);
            Assert.Equal(ErrorCodes.AccountTypeRequired, valueResult.Value!.Extensions["code"]);

            userManagerMock.Verify(
                m => m.CreateAsync(It.IsAny<IdentityUser>(), It.IsAny<string>()),
                Times.Never);
        }

        private static Mock<UserManager<IdentityUser>> MockUserManager()
        {
            var store = new Mock<IUserStore<IdentityUser>>();
            return new Mock<UserManager<IdentityUser>>(
                store.Object, null!, null!, null!, null!, null!, null!, null!, null!);
        }

        private static Mock<RoleManager<IdentityRole>> MockRoleManager()
        {
            var store = new Mock<IRoleStore<IdentityRole>>();
            return new Mock<RoleManager<IdentityRole>>(
                store.Object, null!, null!, null!, null!);
        }
    }
}
