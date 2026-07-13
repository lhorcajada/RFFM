#nullable enable
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Features.Coaches.Clubs;
using RFFM.Api.Features.Coaches.Clubs.Commands;
using RFFM.Api.Infrastructure.Storage;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class CreateClubHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public CreateClubHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task SeedCountryAsync(RFFM.Api.Infrastructure.Persistence.AppDbContext db, string code)
        {
            if (!db.Countries.Any(c => c.Code == code))
            {
                db.Countries.Add(new Country { Name = "España", Code = code });
                await db.SaveChangesAsync();
            }
        }

        [Fact]
        public async Task Handle_CoachUnderQuota_CreatesClubAndUserClubWithIsCreatorTrue()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var countryCode = $"ES{Guid.NewGuid():N}"[..8];
            await SeedCountryAsync(db, countryCode);

            var storage = new Mock<IStorageService>();
            var handler = new CreateClubHandler(db, storage.Object);
            var userId = Guid.NewGuid().ToString();

            var command = new CreateClubCommand
            {
                Name = "FC Test",
                CountryCode = countryCode,
                UserId = userId
            };

            // Act
            await handler.Handle(command, CancellationToken.None);

            // Assert
            var userClub = db.UserClubs.SingleOrDefault(uc => uc.ApplicationUserId == userId);
            Assert.NotNull(userClub);
            Assert.True(userClub!.IsCreator);
        }

        [Fact]
        public async Task Handle_UserAlreadyCreatorOfThreeClubs_ThrowsDomainExceptionWithClubQuotaExceededCode_AndDoesNotCreateClub()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var countryCode = $"ES{Guid.NewGuid():N}"[..8];
            await SeedCountryAsync(db, countryCode);

            var userId = Guid.NewGuid().ToString();

            for (var i = 0; i < ClubConstants.MaxClubsPerCreator; i++)
            {
                var existingClub = Club.Create($"Existing Club {i}", db.Countries.First(c => c.Code == countryCode).Id);
                db.Clubs.Add(existingClub);
                var existingUserClub = new UserClub(userId, existingClub.Id, Membership.Coach.Id)
                {
                    IsCreator = true
                };
                db.UserClubs.Add(existingUserClub);
            }
            await db.SaveChangesAsync();

            var storage = new Mock<IStorageService>();
            var handler = new CreateClubHandler(db, storage.Object);

            var command = new CreateClubCommand
            {
                Name = "One Too Many FC",
                CountryCode = countryCode,
                UserId = userId
            };

            // Act
            var exception = await Assert.ThrowsAsync<DomainException>(
                async () => await handler.Handle(command, CancellationToken.None));

            // Assert
            Assert.Equal(ErrorCodes.ClubQuotaExceeded, exception.Code);
            var clubCount = db.UserClubs.Count(uc => uc.ApplicationUserId == userId);
            Assert.Equal(ClubConstants.MaxClubsPerCreator, clubCount);
        }

        [Fact]
        public async Task Handle_UserBelowQuota_WithTwoExistingCreatedClubs_CreatesThirdClub()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var countryCode = $"ES{Guid.NewGuid():N}"[..8];
            await SeedCountryAsync(db, countryCode);

            var userId = Guid.NewGuid().ToString();

            for (var i = 0; i < ClubConstants.MaxClubsPerCreator - 1; i++)
            {
                var existingClub = Club.Create($"Existing Club {i}", db.Countries.First(c => c.Code == countryCode).Id);
                db.Clubs.Add(existingClub);
                db.UserClubs.Add(new UserClub(userId, existingClub.Id, Membership.Coach.Id) { IsCreator = true });
            }
            await db.SaveChangesAsync();

            var storage = new Mock<IStorageService>();
            var handler = new CreateClubHandler(db, storage.Object);

            var command = new CreateClubCommand
            {
                Name = "Still Allowed FC",
                CountryCode = countryCode,
                UserId = userId
            };

            // Act
            await handler.Handle(command, CancellationToken.None);

            // Assert
            var clubCount = db.UserClubs.Count(uc => uc.ApplicationUserId == userId && uc.IsCreator);
            Assert.Equal(ClubConstants.MaxClubsPerCreator, clubCount);
        }

        [Fact]
        public async Task Validator_RejectsEmptyNameAndCountryCode_QuotaNotConsulted()
        {
            var validator = new CreateValidator();
            var command = new CreateClubCommand
            {
                Name = string.Empty,
                CountryCode = string.Empty,
                UserId = Guid.NewGuid().ToString()
            };

            var result = validator.Validate(command);

            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateClubCommand.Name));
            Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateClubCommand.CountryCode));
        }
    }
}
