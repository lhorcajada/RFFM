#nullable enable
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Logging;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Resources;
using RFFM.Api.Domain.Services;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using System.Text;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class MobileLoginHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public MobileLoginHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;

            // Configure CodeMessages localizer for tests
            var localizerFactory = new MockStringLocalizerFactory();
            CodeMessages.Configure(localizerFactory);
        }

        private TokenService CreateTokenService(IdentityDbContext db)
        {
            var mockConfig = new Mock<IConfiguration>();
            mockConfig.Setup(c => c["Jwt:Key"]).Returns("this-is-a-very-long-secret-key-for-testing-purposes-only-1234567890");
            mockConfig.Setup(c => c["Jwt:Issuer"]).Returns("rffm");
            mockConfig.Setup(c => c["Jwt:Audience"]).Returns("rffm-audience");

            var mockLogger = new Mock<ILogger<TokenService>>();

            return new TokenService(mockConfig.Object, db, mockLogger.Object);
        }

        private async Task<IdentityUser> SeedUserAsync(
            IdentityDbContext db,
            string username,
            string password = "TestPassword123!",
            bool emailConfirmed = true)
        {
            var passwordHasher = new PasswordHasher<IdentityUser>();
            var user = new IdentityUser
            {
                Id = Guid.NewGuid().ToString(),
                UserName = username,
                NormalizedUserName = username.ToUpperInvariant(),
                Email = $"{username}@test.com",
                NormalizedEmail = $"{username}@test.com".ToUpperInvariant(),
                EmailConfirmed = emailConfirmed,
                SecurityStamp = Guid.NewGuid().ToString()
            };

            user.PasswordHash = passwordHasher.HashPassword(user, password);
            db.Users.Add(user);
            await db.SaveChangesAsync();

            return user;
        }

        [Fact]
        public async Task Handle_UserNotExists_ThrowsDomainException_WithLoginUserNotRegisteredCode()
        {
            // Arrange
            await using var db = _fixture.CreateIdentityDbContext();
            var tokenService = CreateTokenService(db);

            // Act & Assert
            var ex = await Assert.ThrowsAsync<DomainException>(
                () => tokenService.GenerateJwtForCredentials("nonexistent", "password123", CancellationToken.None)
            );

            Assert.Equal(CodeMessages.LoginUserNotRegistered.Code, ex.Code);
        }

        [Fact]
        public async Task Handle_EmailNotConfirmed_ThrowsDomainException_WithLoginEmailNotConfirmedCode()
        {
            // Arrange
            await using var db = _fixture.CreateIdentityDbContext();
            var tokenService = CreateTokenService(db);
            var username = $"testuser_{Guid.NewGuid():N}"[..20];
            var user = await SeedUserAsync(db, username, emailConfirmed: false);

            // Act & Assert
            var ex = await Assert.ThrowsAsync<DomainException>(
                () => tokenService.GenerateJwtForCredentials(username, "TestPassword123!", CancellationToken.None)
            );

            Assert.Equal(CodeMessages.LoginEmailNotConfirmed.Code, ex.Code);
        }

        [Fact]
        public async Task Handle_PasswordIncorrect_ThrowsDomainException_WithLoginErrorUserOrPasswordCode()
        {
            // Arrange
            await using var db = _fixture.CreateIdentityDbContext();
            var tokenService = CreateTokenService(db);
            var username = $"testuser_{Guid.NewGuid():N}"[..20];
            var user = await SeedUserAsync(db, username, "TestPassword123!");

            // Act & Assert
            var ex = await Assert.ThrowsAsync<DomainException>(
                () => tokenService.GenerateJwtForCredentials(username, "WrongPassword123!", CancellationToken.None)
            );

            Assert.Equal(CodeMessages.LoginErrorUserOrPassword.Code, ex.Code);
        }

        [Fact]
        public async Task Handle_Success_ReturnsOkResultWithValidJwt()
        {
            // Arrange
            await using var db = _fixture.CreateIdentityDbContext();
            var tokenService = CreateTokenService(db);
            var username = $"testuser_{Guid.NewGuid():N}"[..20];
            var user = await SeedUserAsync(db, username, "TestPassword123!");

            // Act
            var token = await tokenService.GenerateJwtForCredentials(username, "TestPassword123!", CancellationToken.None);

            // Assert
            Assert.NotEmpty(token);
            // Verify it's a valid JWT that can be decoded
            var secretBytes = Encoding.UTF8.GetBytes("this-is-a-very-long-secret-key-for-testing-purposes-only-1234567890");
            var payloadJson = Jose.JWT.Decode(token, secretBytes, Jose.JwsAlgorithm.HS256);
            var payload = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(payloadJson);

            Assert.NotNull(payload);
            Assert.True(payload!.ContainsKey("sub"));
            Assert.Equal(user.Id, payload["sub"]?.ToString());
        }
    }
}
