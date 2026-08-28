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

            // Generate link code and persist it
            teamPlayer.GenerateLinkCode();
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
                PlayerLinkCode = teamPlayer.LinkCode
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

        [Fact]
        public async Task Handle_Player_WithNonExistentLinkCode_ReturnsBadRequestWithPlayerLinkCodeInvalidCode()
        {
            // Test that providing a code that matches no TeamPlayer returns 400 with PlayerLinkCodeInvalid.

            // Arrange
            var userManagerMock = MockUserManager();
            userManagerMock
                .Setup(m => m.FindByNameAsync(It.IsAny<string>()))
                .ReturnsAsync((IdentityUser?)null);
            userManagerMock
                .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
                .ReturnsAsync((IdentityUser?)null);

            var configuration = new ConfigurationBuilder().Build();
            var db = _fixture.CreateDbContext();
            var emailService = new EmailService(configuration, null!);
            var logger = NullLogger<CreateUser.Handler>.Instance;

            var handler = new CreateUser.Handler(
                userManagerMock.Object,
                MockRoleManager().Object,
                emailService,
                configuration,
                db,
                logger);

            var command = new CreateUser.Command
            {
                Alias = $"playernocode{Guid.NewGuid():N}"[..15],
                Email = "playernocode@rffm.test",
                Password = "S3cure!Pass",
                AccountType = AppRoles.Player.Name,
                PlayerLinkCode = "NONEXIST"
            };

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            var badRequest = Assert.IsAssignableFrom<BadRequest<ProblemDetails>>(result);
            Assert.NotNull(badRequest.Value);
            Assert.Equal(ErrorCodes.PlayerLinkCodeInvalid, badRequest.Value.Extensions["code"]);
        }

        [Fact]
        public async Task Handle_Player_WithValidLinkCode_LinksInstantlyAndUpdatesTeamPlayerContactEmail()
        {
            // Registering as Player with a valid link code must link the UserTeam instantly
            // (no pending approval) and update the TeamPlayer's contact email, preserving
            // Address/Phone already on file.

            // Arrange
            await using var setupDb = _fixture.CreateDbContext();

            var club = Club.Create($"Player Valid Code Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Player Valid Code Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            setupDb.Teams.Add(team);
            await setupDb.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "TestPlayer",
                LastName = "ValidCode",
                Alias = "testvalidcode",
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
                ContactInfo = new ContactModel { Phone = "600111222", Address = new AddressModel { Street = "Calle Existente", City = "Sevilla" } },
                FamilyMembers = new List<FamilyModel>()
            });
            setupDb.TeamPlayers.Add(teamPlayer);
            await setupDb.SaveChangesAsync();

            teamPlayer.GenerateLinkCode();
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
                .ReturnsAsync(new List<string> { AppRoles.Player.Name });

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
                Alias = $"playervalidcode{Guid.NewGuid():N}"[..15],
                Email = "playervalidcode@rffm.test",
                Password = "S3cure!Pass",
                AccountType = AppRoles.Player.Name,
                PlayerLinkCode = teamPlayer.LinkCode
            };

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            var okResult = Assert.IsAssignableFrom<Ok<RegisterAccountResponse>>(result);
            Assert.NotNull(okResult.Value);
            Assert.Equal(RegistrationStatus.Active, okResult.Value.Status);
            Assert.NotNull(createdUser);

            await using var assertDb = _fixture.CreateDbContext();

            var userTeam = await assertDb.UserTeams
                .AsNoTracking()
                .FirstOrDefaultAsync(ut => ut.ApplicationUserId == createdUser!.Id);
            Assert.NotNull(userTeam);
            Assert.Equal(teamPlayer.Id, userTeam!.LinkedTeamPlayerId);

            var reloadedTeamPlayer = await assertDb.TeamPlayers
                .AsNoTracking()
                .FirstAsync(tp => tp.Id == teamPlayer.Id);
            Assert.Equal(command.Email, reloadedTeamPlayer.ContactInfo!.Email);
            Assert.Equal("600111222", reloadedTeamPlayer.ContactInfo!.Phone);
            Assert.Equal("Calle Existente", reloadedTeamPlayer.ContactInfo!.Address!.Street);
        }

        [Fact]
        public async Task Handle_Player_WithLinkCodeAlreadyClaimed_ReturnsConflictWithLinkedPlayerAlreadyClaimedCode()
        {
            // A second Player registration against the same LinkCode must be rejected: only one
            // Player account can be linked to a given TeamPlayer.

            // Arrange
            await using var setupDb = _fixture.CreateDbContext();

            var club = Club.Create($"Player Already Claimed Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Player Already Claimed Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            setupDb.Teams.Add(team);
            await setupDb.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "TestPlayer",
                LastName = "AlreadyClaimed",
                Alias = "testalreadyclaimed",
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

            teamPlayer.GenerateLinkCode();
            await setupDb.SaveChangesAsync();

            var firstUserTeam = new UserTeam(Guid.NewGuid().ToString(), team.Id, Membership.Player.Id);
            firstUserTeam.LinkPlayer(teamPlayer.Id);
            setupDb.UserTeams.Add(firstUserTeam);
            await setupDb.SaveChangesAsync();

            var userManagerMock = MockUserManager();
            userManagerMock
                .Setup(m => m.FindByNameAsync(It.IsAny<string>()))
                .ReturnsAsync((IdentityUser?)null);
            userManagerMock
                .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
                .ReturnsAsync((IdentityUser?)null);

            var configuration = new ConfigurationBuilder().Build();
            var db = _fixture.CreateDbContext();
            var emailService = new EmailService(configuration, null!);
            var logger = NullLogger<CreateUser.Handler>.Instance;

            var handler = new CreateUser.Handler(
                userManagerMock.Object,
                MockRoleManager().Object,
                emailService,
                configuration,
                db,
                logger);

            var command = new CreateUser.Command
            {
                Alias = $"playersecond{Guid.NewGuid():N}"[..15],
                Email = "playersecond@rffm.test",
                Password = "S3cure!Pass",
                AccountType = AppRoles.Player.Name,
                PlayerLinkCode = teamPlayer.LinkCode
            };

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            var conflict = Assert.IsAssignableFrom<Conflict<ProblemDetails>>(result);
            Assert.NotNull(conflict.Value);
            Assert.Equal(ErrorCodes.LinkedPlayerAlreadyClaimed, conflict.Value.Extensions["code"]);
        }

        [Fact]
        public async Task Handle_FamilyMember_WithNewEmail_AddsFamilyMemberEntry()
        {
            // Arrange
            await using var setupDb = _fixture.CreateDbContext();

            var club = Club.Create($"FamilyMember New Email Test Club {Guid.NewGuid():N}", 1);
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
                Name = "FamilyMember New Email Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            setupDb.Teams.Add(team);
            await setupDb.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "TestPlayer",
                LastName = "NewEmail",
                Alias = "testnewemail",
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

            teamPlayer.GenerateLinkCode();
            await setupDb.SaveChangesAsync();

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
                Alias = $"familynewemail{Guid.NewGuid():N}"[..15],
                Email = "familynewemail@rffm.test",
                Password = "S3cure!Pass",
                AccountType = AppRoles.FamilyMember.Name,
                PlayerLinkCode = teamPlayer.LinkCode
            };

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            var okResult = Assert.IsAssignableFrom<Ok<RegisterAccountResponse>>(result);
            Assert.NotNull(okResult.Value);
            Assert.Equal(RegistrationStatus.Active, okResult.Value.Status);

            await using var assertDb = _fixture.CreateDbContext();
            var reloadedTeamPlayer = await assertDb.TeamPlayers
                .AsNoTracking()
                .FirstAsync(tp => tp.Id == teamPlayer.Id);
            Assert.Contains(reloadedTeamPlayer.FamilyMembers, f => f.Email == command.Email);
        }

        [Fact]
        public async Task Handle_FamilyMember_WithEmailAlreadyInFamilyMembers_DoesNotDuplicate_ButStillLinksUser()
        {
            // Arrange
            await using var setupDb = _fixture.CreateDbContext();

            var club = Club.Create($"FamilyMember Existing Email Test Club {Guid.NewGuid():N}", 1);
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
                Name = "FamilyMember Existing Email Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            setupDb.Teams.Add(team);
            await setupDb.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "TestPlayer",
                LastName = "ExistingEmail",
                Alias = "testexistingemail",
                ClubId = club.Id
            });
            setupDb.Players.Add(player);
            await setupDb.SaveChangesAsync();

            const string existingFamilyEmail = "family-existing@rffm.test";
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

            teamPlayer.AddFamilyMemberEmailIfMissing(existingFamilyEmail);
            teamPlayer.GenerateLinkCode();
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
                Alias = $"familyexistingemail{Guid.NewGuid():N}"[..15],
                Email = existingFamilyEmail,
                Password = "S3cure!Pass",
                AccountType = AppRoles.FamilyMember.Name,
                PlayerLinkCode = teamPlayer.LinkCode
            };

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            var okResult = Assert.IsAssignableFrom<Ok<RegisterAccountResponse>>(result);
            Assert.NotNull(okResult.Value);
            Assert.Equal(RegistrationStatus.Active, okResult.Value.Status);
            Assert.NotNull(createdUser);

            await using var assertDb = _fixture.CreateDbContext();

            var reloadedTeamPlayer = await assertDb.TeamPlayers
                .AsNoTracking()
                .FirstAsync(tp => tp.Id == teamPlayer.Id);
            Assert.Single(reloadedTeamPlayer.FamilyMembers);

            var userTeam = await assertDb.UserTeams
                .AsNoTracking()
                .FirstOrDefaultAsync(ut => ut.ApplicationUserId == createdUser!.Id);
            Assert.NotNull(userTeam);
        }

        [Fact]
        public async Task Handle_MultipleFamilyMembers_ForSameTeamPlayer_AllLinkSuccessfully()
        {
            // Arrange
            await using var setupDb = _fixture.CreateDbContext();

            var club = Club.Create($"Multiple FamilyMembers Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Multiple FamilyMembers Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            setupDb.Teams.Add(team);
            await setupDb.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "TestPlayer",
                LastName = "MultipleFamily",
                Alias = "testmultiplefamily",
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

            teamPlayer.GenerateLinkCode();
            await setupDb.SaveChangesAsync();

            var configuration = new ConfigurationBuilder().Build();
            var emailService = new EmailService(configuration, null!);
            var logger = NullLogger<CreateUser.Handler>.Instance;

            async Task<IResult> RegisterFamilyMemberAsync(string alias, string email)
            {
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
                    .ReturnsAsync(new List<string> { AppRoles.FamilyMember.Name });

                var roleManagerMock = MockRoleManager();
                roleManagerMock
                    .Setup(m => m.RoleExistsAsync(It.IsAny<string>()))
                    .ReturnsAsync(true);

                var db = _fixture.CreateDbContext();
                var handler = new CreateUser.Handler(
                    userManagerMock.Object,
                    roleManagerMock.Object,
                    emailService,
                    configuration,
                    db,
                    logger);

                var command = new CreateUser.Command
                {
                    Alias = alias,
                    Email = email,
                    Password = "S3cure!Pass",
                    AccountType = AppRoles.FamilyMember.Name,
                    PlayerLinkCode = teamPlayer.LinkCode
                };

                return await handler.Handle(command, CancellationToken.None);
            }

            // Act
            var firstResult = await RegisterFamilyMemberAsync($"family1{Guid.NewGuid():N}"[..15], "family1@rffm.test");
            var secondResult = await RegisterFamilyMemberAsync($"family2{Guid.NewGuid():N}"[..15], "family2@rffm.test");

            // Assert
            var firstOk = Assert.IsAssignableFrom<Ok<RegisterAccountResponse>>(firstResult);
            var secondOk = Assert.IsAssignableFrom<Ok<RegisterAccountResponse>>(secondResult);
            Assert.Equal(RegistrationStatus.Active, firstOk.Value!.Status);
            Assert.Equal(RegistrationStatus.Active, secondOk.Value!.Status);

            await using var assertDb = _fixture.CreateDbContext();
            var userTeamsCount = await assertDb.UserTeams
                .AsNoTracking()
                .CountAsync(ut => ut.LinkedTeamPlayerId == teamPlayer.Id && ut.RoleId == Membership.FamilyPlayer.Id);
            Assert.Equal(2, userTeamsCount);
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
