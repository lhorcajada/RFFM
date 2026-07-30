#nullable enable
using System.Threading.Tasks;
using FluentValidation;
using RFFM.Api.Features.Coaches.News;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class NewsValidatorTests
    {
        [Fact]
        public async Task CreateNewsValidator_RequiredTitle()
        {
            var validator = new CreateNewsValidator();
            var command = new CreateNewsCommand("", "Sub", "Body", "url", "Draft");
            var result = await validator.ValidateAsync(command);
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == "Title");
        }

        [Fact]
        public async Task CreateNewsValidator_RequiredSubtitle()
        {
            var validator = new CreateNewsValidator();
            var command = new CreateNewsCommand("Title", "", "Body", "url", "Draft");
            var result = await validator.ValidateAsync(command);
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == "Subtitle");
        }

        [Fact]
        public async Task CreateNewsValidator_RequiredBody()
        {
            var validator = new CreateNewsValidator();
            var command = new CreateNewsCommand("Title", "Sub", "", "url", "Draft");
            var result = await validator.ValidateAsync(command);
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == "Body");
        }

        [Fact]
        public async Task CreateNewsValidator_RequiredCoverImageUrl()
        {
            var validator = new CreateNewsValidator();
            var command = new CreateNewsCommand("Title", "Sub", "Body", "", "Draft");
            var result = await validator.ValidateAsync(command);
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == "CoverImageUrl");
        }

        [Fact]
        public async Task CreateNewsValidator_InvalidStatus()
        {
            var validator = new CreateNewsValidator();
            var command = new CreateNewsCommand("Title", "Sub", "Body", "url", "Invalid");
            var result = await validator.ValidateAsync(command);
            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == "Status");
        }

        [Fact]
        public async Task CreateNewsValidator_ValidCommand()
        {
            var validator = new CreateNewsValidator();
            var command = new CreateNewsCommand("Title", "Subtitle", "Body", "url", "Draft");
            var result = await validator.ValidateAsync(command);
            Assert.True(result.IsValid);
        }

        [Fact]
        public async Task UpdateNewsValidator_RequiredTitle()
        {
            var validator = new UpdateNewsValidator();
            var command = new UpdateNewsCommand("", "Sub", "Body", "url");
            var result = await validator.ValidateAsync(command);
            Assert.False(result.IsValid);
        }

        [Fact]
        public async Task UpdateNewsValidator_ValidCommand()
        {
            var validator = new UpdateNewsValidator();
            var command = new UpdateNewsCommand("Title", "Sub", "Body", "url");
            var result = await validator.ValidateAsync(command);
            Assert.True(result.IsValid);
        }

        [Fact]
        public async Task UploadNewsImageValidator_RequiredFile()
        {
            var validator = new UploadNewsImageValidator();
            var command = new UploadNewsImageCommand { File = null! };
            var result = await validator.ValidateAsync(command);
            Assert.False(result.IsValid);
        }
    }
}
