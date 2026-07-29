#nullable enable
using System.IO;
using System.Text;
using Microsoft.AspNetCore.Http;
using RFFM.Api.Features.Coaches.GameModels.Commands;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class UploadScenarioMediaValidatorTests
    {
        private static IFormFile CreateFormFile(string contentType, int length)
        {
            var content = Encoding.UTF8.GetBytes(new string('a', length));
            var stream = new MemoryStream(content);
            return new FormFile(stream, 0, stream.Length, "file", "file.bin")
            {
                Headers = new HeaderDictionary(),
                ContentType = contentType
            };
        }

        private static UploadScenarioMediaCommand Command(IFormFile file) =>
            new("scenario-1", file, "user-1");

        [Fact]
        public void Validate_DisallowedContentType_IsInvalid()
        {
            var validator = new UploadScenarioMediaValidator();
            var result = validator.Validate(Command(CreateFormFile("application/pdf", 100)));
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_FileTooLarge_IsInvalid()
        {
            var validator = new UploadScenarioMediaValidator();
            var result = validator.Validate(Command(CreateFormFile("image/jpeg", 21 * 1024 * 1024)));
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_EmptyFile_IsInvalid()
        {
            var validator = new UploadScenarioMediaValidator();
            var result = validator.Validate(Command(CreateFormFile("image/jpeg", 0)));
            Assert.False(result.IsValid);
        }

        [Theory]
        [InlineData("image/jpeg")]
        [InlineData("image/png")]
        [InlineData("image/webp")]
        [InlineData("video/mp4")]
        [InlineData("video/webm")]
        public void Validate_AllowedContentTypeWithinLimit_IsValid(string contentType)
        {
            var validator = new UploadScenarioMediaValidator();
            var result = validator.Validate(Command(CreateFormFile(contentType, 100)));
            Assert.True(result.IsValid);
        }
    }
}
