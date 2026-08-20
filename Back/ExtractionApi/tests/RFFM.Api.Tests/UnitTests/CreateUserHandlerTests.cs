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
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Auth;
using RFFM.Api.Features.Coaches.Users.Commands;
using RFFM.Api.Infrastructure.Services.Email;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class CreateUserHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public CreateUserHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

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
            var db = _fixture.CreateDbContext();
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
            var db = _fixture.CreateDbContext();
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
            var db = _fixture.CreateDbContext();
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
                AccountType = "Coach",
                TrialAccepted = true  // Required for Coach without code
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
            var db = _fixture.CreateDbContext();
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
                AccountType = null!  // Missing required field
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

        [Fact]
        public async Task Handle_ClubDirector_WithoutTrialAccepted_ReturnsBadRequestWithTrialAcceptanceRequired()
        {
            // Arrange
            var userManagerMock = MockUserManager();
            userManagerMock
                .Setup(m => m.FindByNameAsync(It.IsAny<string>()))
                .ReturnsAsync((IdentityUser?)null);
            userManagerMock
                .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
                .ReturnsAsync((IdentityUser?)null);

            var roleManagerMock = MockRoleManager();
            var configuration = new ConfigurationBuilder().Build();
            var db = _fixture.CreateDbContext();
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
                Alias = "newdirector",
                Email = "newdirector@rffm.test",
                Password = "S3cure!Pass",
                AccountType = "ClubDirector",
                TrialAccepted = false
            };

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status400BadRequest, statusCodeResult.StatusCode);

            var valueResult = Assert.IsAssignableFrom<IValueHttpResult<ProblemDetails>>(result);
            Assert.NotNull(valueResult.Value);
            Assert.Equal(ErrorCodes.TrialAcceptanceRequired, valueResult.Value!.Extensions["code"]);
        }

        [Fact]
        public async Task Handle_Coach_WithoutCodeAndWithoutTrialAccepted_ReturnsBadRequestWithTrialAcceptanceRequired()
        {
            // Arrange
            var userManagerMock = MockUserManager();
            userManagerMock
                .Setup(m => m.FindByNameAsync(It.IsAny<string>()))
                .ReturnsAsync((IdentityUser?)null);
            userManagerMock
                .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
                .ReturnsAsync((IdentityUser?)null);

            var roleManagerMock = MockRoleManager();
            var configuration = new ConfigurationBuilder().Build();
            var db = _fixture.CreateDbContext();
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
                Alias = "newcoach2",
                Email = "newcoach2@rffm.test",
                Password = "S3cure!Pass",
                AccountType = "Coach",
                TrialAccepted = false
            };

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status400BadRequest, statusCodeResult.StatusCode);

            var valueResult = Assert.IsAssignableFrom<IValueHttpResult<ProblemDetails>>(result);
            Assert.NotNull(valueResult.Value);
            Assert.Equal(ErrorCodes.TrialAcceptanceRequired, valueResult.Value!.Extensions["code"]);
        }

        [Fact]
        public async Task Handle_Fan_WithNoCodeOrTrial_CreatesActiveAccountWithFanRole()
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
                .ReturnsAsync(IdentityResult.Success);
            userManagerMock
                .Setup(m => m.GetRolesAsync(It.IsAny<IdentityUser>()))
                .ReturnsAsync(new List<string> { AppRoles.Fan.Name });

            var roleManagerMock = MockRoleManager();
            roleManagerMock
                .Setup(m => m.RoleExistsAsync(It.IsAny<string>()))
                .ReturnsAsync(true);

            var configuration = new ConfigurationBuilder().Build();
            var db = _fixture.CreateDbContext();
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
                Alias = "newfan",
                Email = "newfan@rffm.test",
                Password = "S3cure!Pass",
                AccountType = "Fan"
            };

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            var okResult = Assert.IsAssignableFrom<Ok<RegisterAccountResponse>>(result);
            Assert.NotNull(okResult.Value);
            Assert.Equal(RegistrationStatus.Active, okResult.Value.Status);
            Assert.Null(okResult.Value.ClubJoinRequestId);
            Assert.Contains(AppRoles.Fan.Name, okResult.Value.Roles);
        }

        [Fact]
        public async Task Handle_FamilyMember_WithValidInvitationAndTeamPlayer_CreatesUserProfileSoLoginDoesNotReAskForPlayer()
        {
            // Regression test: registering as FamilyMember must persist the chosen player/team
            // into UserProfile immediately, mirroring VerifyPlayerIdentity's SaveUserProfileAsync,
            // so GET /api/users/me/profile (consulted by the frontend right after login) already
            // has it and the app never re-prompts for player selection post-registration.

            // Arrange
            await using var setupDb = _fixture.CreateDbContext();

            var club = Club.Create($"FamilyMember Test Club {Guid.NewGuid():N}", 1);
            setupDb.Clubs.Add(club);
            await setupDb.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}",
                DateTime.UtcNow,
                DateTime.UtcNow.AddMonths(9),
                isActive: true,
                club: club);
            setupDb.Seasons.Add(season);
            await setupDb.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "FamilyMember Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            setupDb.Teams.Add(team);
            await setupDb.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "Hijo",
                LastName = "DePrueba",
                Alias = "hijo",
                ClubId = club.Id
            });
            setupDb.Players.Add(player);
            await setupDb.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = team.Id,
                SeasonId = season.Id,
                JoinedDate = DateTime.UtcNow,
                FamilyMembers = new List<FamilyModel>()
            });
            setupDb.TeamPlayers.Add(teamPlayer);
            await setupDb.SaveChangesAsync();

            var userManagerMock = MockUserManager();
            userManagerMock
                .Setup(m => m.FindByNameAsync(It.IsAny<string>()))
                .ReturnsAsync((IdentityUser?)null);
            userManagerMock
                .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
                .ReturnsAsync((IdentityUser?)null);

            IdentityUser? createdUser = null;
            userManagerMock
                .Setup(m => m.CreateAsync(It.IsAny<IdentityUser>(), It.IsAny<string>()))
                .Callback<IdentityUser, string>((u, _) => createdUser = u)
                .ReturnsAsync(IdentityResult.Success);
            userManagerMock
                .Setup(m => m.GetRolesAsync(It.IsAny<IdentityUser>()))
                .ReturnsAsync(new List<string> { AppRoles.FamilyMember.Name });

            var roleManagerMock = MockRoleManager();
            roleManagerMock
                .Setup(m => m.RoleExistsAsync(It.IsAny<string>()))
                .ReturnsAsync(true);

            var configuration = new ConfigurationBuilder().Build();
            var db = _fixture.CreateDbContext();
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
                Alias = $"family{Guid.NewGuid():N}"[..15],
                Email = "family@rffm.test",
                Password = "S3cure!Pass",
                AccountType = AppRoles.FamilyMember.Name,
                TeamInvitationCode = team.JoinCode,
                TeamPlayerId = teamPlayer.Id
            };

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            var okResult = Assert.IsAssignableFrom<Ok<RegisterAccountResponse>>(result);
            Assert.NotNull(okResult.Value);
            Assert.Equal(RegistrationStatus.Active, okResult.Value.Status);
            Assert.NotNull(createdUser);

            await using var assertDb = _fixture.CreateDbContext();
            var profile = await assertDb.UserProfiles
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.ApplicationUserId == createdUser!.Id);

            Assert.NotNull(profile);
            Assert.Equal(AppRoles.FamilyMember.Name, profile!.RoleName);
            Assert.Equal(teamPlayer.Id, profile.PlayerId);
            Assert.Equal(team.Id, profile.TeamId);
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
