#nullable enable
using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Features.Coaches.Users;
using RFFM.Api.Features.Coaches.Users.Commands;
using RFFM.Api.Infrastructure.Storage;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class UploadMyAvatarValidatorTests
    {
        private static IFormFile File(long length, string contentType = "image/png", string name = "foto.png")
        {
            var file = new Mock<IFormFile>();
            file.Setup(f => f.Length).Returns(length);
            file.Setup(f => f.ContentType).Returns(contentType);
            file.Setup(f => f.FileName).Returns(name);
            return file.Object;
        }

        private static bool IsValid(IFormFile? file) =>
            new UploadMyAvatar.Validator().Validate(new UploadMyAvatar.Command { UserId = "user-1", File = file! }).IsValid;

        [Theory]
        [InlineData("image/png")]
        [InlineData("image/jpeg")]
        [InlineData("image/webp")]
        public void Validate_AllowedImage_IsValid(string contentType)
        {
            Assert.True(IsValid(File(500 * 1024, contentType)));
        }

        [Fact]
        public void Validate_EmptyFile_IsInvalid()
        {
            Assert.False(IsValid(File(0)));
        }

        [Fact]
        public void Validate_FileOver2Mb_IsInvalid()
        {
            Assert.False(IsValid(File(2 * 1024 * 1024 + 1)));
        }

        [Fact]
        public void Validate_NotAnImage_IsInvalid()
        {
            Assert.False(IsValid(File(1000, "application/pdf", "doc.pdf")));
        }

        [Fact]
        public void Validate_MissingFile_IsInvalid()
        {
            Assert.False(IsValid(null));
        }
    }

    public class ChangeMyPasswordValidatorTests
    {
        private static bool IsValid(string current, string next) =>
            new ChangeMyPassword.Validator()
                .Validate(new ChangeMyPassword.Command { UserId = "user-1", CurrentPassword = current, NewPassword = next })
                .IsValid;

        [Fact]
        public void Validate_DifferentPasswords_IsValid()
        {
            Assert.True(IsValid("Antigua1!", "Nueva123!"));
        }

        [Fact]
        public void Validate_SamePassword_IsInvalid()
        {
            Assert.False(IsValid("Antigua1!", "Antigua1!"));
        }

        [Theory]
        [InlineData("", "Nueva123!")]
        [InlineData("Antigua1!", "")]
        public void Validate_EmptyPassword_IsInvalid(string current, string next)
        {
            Assert.False(IsValid(current, next));
        }
    }

    public class ChangeMyPasswordHandlerTests
    {
        private static (Mock<UserManager<IdentityUser>> Manager, IdentityUser User) MockUser()
        {
            var user = new IdentityUser { Id = "user-1", UserName = "anag" };
            var store = new Mock<IUserStore<IdentityUser>>();
            var manager = new Mock<UserManager<IdentityUser>>(
                store.Object, null!, null!, null!, null!, null!, null!, null!, null!);
            manager.Setup(m => m.FindByIdAsync(user.Id)).ReturnsAsync(user);
            return (manager, user);
        }

        private static ChangeMyPassword.Command Command() =>
            new() { UserId = "user-1", CurrentPassword = "Antigua1!", NewPassword = "Nueva123!" };

        [Fact]
        public async Task Handle_WrongCurrentPassword_ThrowsCurrentPasswordIncorrect()
        {
            var (manager, user) = MockUser();
            manager.Setup(m => m.CheckPasswordAsync(user, "Antigua1!")).ReturnsAsync(false);

            var ex = await Assert.ThrowsAsync<DomainException>(() =>
                new ChangeMyPassword.Handler(manager.Object).Handle(Command(), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.CurrentPasswordIncorrect, ex.Code);
        }

        [Fact]
        public async Task Handle_IdentityRejectsNewPassword_ThrowsPasswordChangeFailed()
        {
            var (manager, user) = MockUser();
            manager.Setup(m => m.CheckPasswordAsync(user, "Antigua1!")).ReturnsAsync(true);
            manager.Setup(m => m.ChangePasswordAsync(user, "Antigua1!", "Nueva123!"))
                .ReturnsAsync(IdentityResult.Failed(new IdentityError { Code = "PasswordTooShort", Description = "Demasiado corta" }));

            var ex = await Assert.ThrowsAsync<DomainException>(() =>
                new ChangeMyPassword.Handler(manager.Object).Handle(Command(), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.PasswordChangeFailed, ex.Code);
            Assert.Equal("Demasiado corta", ex.Description);
        }

        [Fact]
        public async Task Handle_ValidPasswords_ChangesPassword()
        {
            var (manager, user) = MockUser();
            manager.Setup(m => m.CheckPasswordAsync(user, "Antigua1!")).ReturnsAsync(true);
            manager.Setup(m => m.ChangePasswordAsync(user, "Antigua1!", "Nueva123!")).ReturnsAsync(IdentityResult.Success);

            await new ChangeMyPassword.Handler(manager.Object).Handle(Command(), CancellationToken.None);

            manager.Verify(m => m.ChangePasswordAsync(user, "Antigua1!", "Nueva123!"), Times.Once);
        }
    }

    [Collection(PostgresCollection.Name)]
    public class MyAvatarHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public MyAvatarHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static IFormFile PngFile()
        {
            var file = new Mock<IFormFile>();
            file.Setup(f => f.Length).Returns(1000);
            file.Setup(f => f.ContentType).Returns("image/png");
            file.Setup(f => f.FileName).Returns("foto.png");
            file.Setup(f => f.OpenReadStream()).Returns(new MemoryStream(new byte[1000]));
            return file.Object;
        }

        private async Task<string> SeedPersonalDataAsync(string? avatarUrl = null)
        {
            var userId = Guid.NewGuid().ToString();
            await using var db = _fixture.CreateDbContext();
            var data = UserPersonalData.Create(userId, "Ana", "García", null, null);
            if (avatarUrl is not null) data.SetAvatar(avatarUrl);
            db.UserPersonalData.Add(data);
            await db.SaveChangesAsync();
            return userId;
        }

        private static Mock<IStorageService> Storage()
        {
            var storage = new Mock<IStorageService>();
            storage.Setup(s => s.UploadAsync(UserConstants.AvatarsContainerName, It.IsAny<string>(), It.IsAny<IFormFile>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((string bucket, string path, IFormFile _, CancellationToken _) => $"https://cdn/storage/v1/object/public/{bucket}/{path}");
            storage.Setup(s => s.DeleteAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
            return storage;
        }

        [Fact]
        public async Task Upload_WithoutPersonalData_ThrowsPersonalDataRequired()
        {
            await using var db = _fixture.CreateDbContext();
            var storage = Storage();

            var ex = await Assert.ThrowsAsync<DomainException>(() => new UploadMyAvatar.Handler(db, storage.Object, NullLogger<UploadMyAvatar.Handler>.Instance)
                .Handle(new UploadMyAvatar.Command { UserId = Guid.NewGuid().ToString(), File = PngFile() }, CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.PersonalDataRequired, ex.Code);
            storage.Verify(s => s.UploadAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IFormFile>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Upload_StoresUnderUserFolderAndSavesUrl()
        {
            var userId = await SeedPersonalDataAsync();
            await using var db = _fixture.CreateDbContext();

            var result = await new UploadMyAvatar.Handler(db, Storage().Object, NullLogger<UploadMyAvatar.Handler>.Instance)
                .Handle(new UploadMyAvatar.Command { UserId = userId, File = PngFile() }, CancellationToken.None);

            Assert.StartsWith($"https://cdn/storage/v1/object/public/avatars/{userId}/", result.AvatarUrl);
            Assert.EndsWith(".png", result.AvatarUrl);
            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.UserPersonalData.SingleAsync(p => p.ApplicationUserId == userId);
            Assert.Equal(result.AvatarUrl, stored.AvatarUrl);
        }

        [Fact]
        public async Task Upload_DeletesPreviousAvatar()
        {
            var userId = Guid.NewGuid().ToString();
            var previousUrl = $"https://cdn/storage/v1/object/public/avatars/{userId}/old.png";
            await using (var seedDb = _fixture.CreateDbContext())
            {
                var data = UserPersonalData.Create(userId, "Ana", "García", null, null);
                data.SetAvatar(previousUrl);
                seedDb.UserPersonalData.Add(data);
                await seedDb.SaveChangesAsync();
            }
            await using var db = _fixture.CreateDbContext();
            var storage = Storage();

            await new UploadMyAvatar.Handler(db, storage.Object, NullLogger<UploadMyAvatar.Handler>.Instance)
                .Handle(new UploadMyAvatar.Command { UserId = userId, File = PngFile() }, CancellationToken.None);

            storage.Verify(s => s.DeleteAsync(UserConstants.AvatarsContainerName, $"{userId}/old.png", It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Delete_ClearsUrlAndRemovesFile()
        {
            var userId = Guid.NewGuid().ToString();
            await using (var seedDb = _fixture.CreateDbContext())
            {
                var data = UserPersonalData.Create(userId, "Ana", "García", null, null);
                data.SetAvatar($"avatars/{userId}/a.png");
                seedDb.UserPersonalData.Add(data);
                await seedDb.SaveChangesAsync();
            }
            await using var db = _fixture.CreateDbContext();
            var storage = Storage();

            await new DeleteMyAvatar.Handler(db, storage.Object, NullLogger<DeleteMyAvatar.Handler>.Instance)
                .Handle(new DeleteMyAvatar.Command(userId), CancellationToken.None);

            storage.Verify(s => s.DeleteAsync(UserConstants.AvatarsContainerName, $"{userId}/a.png", It.IsAny<CancellationToken>()), Times.Once);
            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.UserPersonalData.SingleAsync(p => p.ApplicationUserId == userId);
            Assert.Null(stored.AvatarUrl);
        }

        [Fact]
        public async Task Delete_WithoutAvatarOrData_DoesNotFail()
        {
            await using var db = _fixture.CreateDbContext();
            var storage = Storage();

            await new DeleteMyAvatar.Handler(db, storage.Object, NullLogger<DeleteMyAvatar.Handler>.Instance)
                .Handle(new DeleteMyAvatar.Command(Guid.NewGuid().ToString()), CancellationToken.None);

            storage.Verify(s => s.DeleteAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Theory]
        [InlineData("https://cdn/storage/v1/object/public/avatars/u1/a.png", "u1/a.png")]
        [InlineData("https://cdn/storage/v1/object/public/avatars/u1/a.png?", "u1/a.png")]
        [InlineData("avatars/u1/a.png", "u1/a.png")]
        [InlineData("https://elsewhere/x.png", null)]
        public void AvatarPathFromUrl_ExtractsPathInsideBucket(string url, string? expected)
        {
            Assert.Equal(expected, UserConstants.AvatarPathFromUrl(url));
        }
    }
}
