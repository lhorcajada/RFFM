#nullable enable
using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;
using RFFM.Api.Domain.Entities.AiProviders;
using RFFM.Api.Features.AiSettings;
using RFFM.Api.Features.AiSettings.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class AiProviderValidationTests
    {
        private const string ValidKey = "sk-valid-key-1234";

        private static CreateAiProvider.CreateAiProviderCommand ValidCreate() =>
            new(AiProviderTemplates.OpenAi, "https://api.openai.com/v1", ValidKey, "gpt-4o-mini");

        private static string[] ErrorsFor(CreateAiProvider.CreateAiProviderCommand command) =>
            new CreateAiProvider.Validator().Validate(command).Errors
                .Select(e => $"{e.PropertyName}: {e.ErrorMessage}")
                .ToArray();

        [Fact]
        public void Create_WithAllFields_IsValid()
        {
            Assert.Empty(ErrorsFor(ValidCreate()));
        }

        [Theory]
        [InlineData(nameof(CreateAiProvider.CreateAiProviderCommand.Template))]
        [InlineData(nameof(CreateAiProvider.CreateAiProviderCommand.BaseUrl))]
        [InlineData(nameof(CreateAiProvider.CreateAiProviderCommand.ApiKey))]
        [InlineData(nameof(CreateAiProvider.CreateAiProviderCommand.Model))]
        public void Create_WithAMissingField_IsRejectedNamingThatField(string field)
        {
            var command = field switch
            {
                nameof(CreateAiProvider.CreateAiProviderCommand.Template) => ValidCreate() with { Template = null },
                nameof(CreateAiProvider.CreateAiProviderCommand.BaseUrl) => ValidCreate() with { BaseUrl = " " },
                nameof(CreateAiProvider.CreateAiProviderCommand.ApiKey) => ValidCreate() with { ApiKey = "" },
                _ => ValidCreate() with { Model = null }
            };

            var errors = ErrorsFor(command);

            var error = Assert.Single(errors);
            Assert.StartsWith($"{field}: ", error);
        }

        [Fact]
        public void Create_WithUnknownTemplate_IsRejected()
        {
            var errors = ErrorsFor(ValidCreate() with { Template = "mistral" });

            Assert.Contains(errors, e => e.StartsWith("Template: "));
        }

        [Theory]
        [InlineData("http://api.openai.com/v1")]
        [InlineData("api.openai.com")]
        [InlineData("ftp://api.openai.com")]
        public void Create_WithNonHttpsBaseUrl_IsRejected(string baseUrl)
        {
            var errors = ErrorsFor(ValidCreate() with { BaseUrl = baseUrl });

            Assert.Contains(errors, e => e.StartsWith("BaseUrl: "));
        }

        [Fact]
        public void Create_WithTooShortApiKey_IsRejected()
        {
            var errors = ErrorsFor(ValidCreate() with { ApiKey = "short" });

            Assert.Contains(errors, e => e.StartsWith("ApiKey: "));
        }

        [Fact]
        public void Update_WithoutApiKey_IsValid()
        {
            var command = new UpdateAiProvider.UpdateAiProviderCommand(AiProviderTemplates.Gemini, "https://example.com/v1", null, "gemini-2.0-flash");

            Assert.Empty(new UpdateAiProvider.Validator().Validate(command).Errors);
        }

        [Fact]
        public void Update_WithATooShortNewApiKey_IsRejected()
        {
            var command = new UpdateAiProvider.UpdateAiProviderCommand(AiProviderTemplates.Gemini, "https://example.com/v1", "abc", "m");

            Assert.Contains(new UpdateAiProvider.Validator().Validate(command).Errors, e => e.PropertyName == "ApiKey");
        }

        [Fact]
        public void Test_WithoutIdAndWithoutApiKey_IsRejected()
        {
            var command = new TestAiProviderConnection.TestAiProviderConnectionCommand(null, AiProviderTemplates.OpenAi, "https://api.openai.com/v1", null, "gpt-4o-mini");

            Assert.Contains(new TestAiProviderConnection.Validator().Validate(command).Errors, e => e.PropertyName == "ApiKey");
        }

        [Fact]
        public void Test_WithIdAndWithoutApiKey_IsValid()
        {
            var command = new TestAiProviderConnection.TestAiProviderConnectionCommand("p1", AiProviderTemplates.OpenAi, "https://api.openai.com/v1", null, "gpt-4o-mini");

            Assert.Empty(new TestAiProviderConnection.Validator().Validate(command).Errors);
        }

        [Fact]
        public void Protector_EncryptsTheKeyAndRoundTrips()
        {
            var protector = new AiApiKeyProtector(new EphemeralDataProtectionProvider());

            var cipher = protector.Protect(ValidKey);

            Assert.DoesNotContain(ValidKey, cipher);
            Assert.Equal(ValidKey, protector.Unprotect(cipher));
        }

        [Fact]
        public void Protector_CannotReadAKeyProtectedWithAnotherKeyRing()
        {
            var cipher = new AiApiKeyProtector(new EphemeralDataProtectionProvider()).Protect(ValidKey);

            Assert.ThrowsAny<CryptographicException>(
                () => new AiApiKeyProtector(new EphemeralDataProtectionProvider()).Unprotect(cipher));
        }

        [Fact]
        public void Mask_ShowsOnlyTheLastFourCharacters()
        {
            var mask = AiApiKeyMask.Mask(AiApiKeyMask.Tail(ValidKey));

            Assert.Equal("****1234", mask);
        }

        [Fact]
        public void Template_MapsClaudeToTheNativeAdapterAndTheRestToOpenAiCompatible()
        {
            Assert.Equal(AiProviderType.Claude, AiProviderTemplates.TypeFor(AiProviderTemplates.Claude));
            Assert.Equal(AiProviderType.OpenAiCompatible, AiProviderTemplates.TypeFor(AiProviderTemplates.OpenAi));
            Assert.Equal(AiProviderType.OpenAiCompatible, AiProviderTemplates.TypeFor(AiProviderTemplates.Gemini));
            Assert.Equal(AiProviderType.OpenAiCompatible, AiProviderTemplates.TypeFor(AiProviderTemplates.Custom));
        }
    }
}
