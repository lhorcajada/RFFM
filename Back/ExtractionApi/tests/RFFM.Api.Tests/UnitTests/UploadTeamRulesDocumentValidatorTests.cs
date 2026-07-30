#nullable enable
using System.IO;
using System.Text;
using Microsoft.AspNetCore.Http;
using RFFM.Api.Features.Mobile.Teams.Commands;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class UploadTeamRulesDocumentValidatorTests
    {
        private static IFormFile CreateFormFile(string contentType, int length)
        {
            var content = Encoding.UTF8.GetBytes(new string('a', length));
            var stream = new MemoryStream(content);
            return new FormFile(stream, 0, stream.Length, "file", "rules.pdf")
            {
                Headers = new HeaderDictionary(),
                ContentType = contentType
            };
        }

        private static UploadTeamRulesDocument.UploadTeamRulesDocumentCommand Command(IFormFile file) =>
            new() { TeamId = "team-1", File = file };

        [Fact]
        public void Validate_DisallowedContentType_IsInvalid()
        {
            var validator = new UploadTeamRulesDocument.Validator();
            var result = validator.Validate(Command(CreateFormFile("image/jpeg", 100)));
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_FileTooLarge_IsInvalid()
        {
            var validator = new UploadTeamRulesDocument.Validator();
            var result = validator.Validate(Command(CreateFormFile("application/pdf", 21 * 1024 * 1024)));
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_EmptyFile_IsInvalid()
        {
            var validator = new UploadTeamRulesDocument.Validator();
            var result = validator.Validate(Command(CreateFormFile("application/pdf", 0)));
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_ValidPdfWithinLimit_IsValid()
        {
            var validator = new UploadTeamRulesDocument.Validator();
            var result = validator.Validate(Command(CreateFormFile("application/pdf", 100)));
            Assert.True(result.IsValid);
        }

        [Fact]
        public void Validate_PdfAtExactly20Mb_IsValid()
        {
            var validator = new UploadTeamRulesDocument.Validator();
            var result = validator.Validate(Command(CreateFormFile("application/pdf", 20 * 1024 * 1024)));
            Assert.True(result.IsValid);
        }
    }
}
