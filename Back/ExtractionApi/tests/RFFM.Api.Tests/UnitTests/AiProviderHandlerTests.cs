#nullable enable
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.AiProviders;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.AiSettings;
using RFFM.Api.Features.AiSettings.Services;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class AiProviderHandlerTests
    {
        private const string PublicUrl = "https://8.8.8.8/v1";
        private const string SecretKey = "sk-live-secret-key-9876";

        private readonly PostgresContainerFixture _fixture;
        private readonly IAiApiKeyProtector _protector = new AiApiKeyProtector(new EphemeralDataProtectionProvider());
        private readonly IAiBaseUrlGuard _guard = new AiBaseUrlGuard();

        public AiProviderHandlerTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private static ICurrentUserService CurrentUser(string userId)
        {
            var mock = new Mock<ICurrentUserService>();
            mock.Setup(u => u.UserId).Returns(userId);
            mock.Setup(u => u.IsAuthenticated).Returns(true);
            return mock.Object;
        }

        private static string NewUserId() => Guid.NewGuid().ToString();

        private CreateAiProvider.Handler CreateHandler(AppDbContext db, string userId) =>
            new(db, CurrentUser(userId), _protector, _guard);

        private Task<AiProviderDto> CreateProviderAsync(AppDbContext db, string userId, string baseUrl = PublicUrl, string key = SecretKey) =>
            CreateHandler(db, userId).Handle(
                new CreateAiProvider.CreateAiProviderCommand(AiProviderTemplates.OpenAi, baseUrl, key, "gpt-4o-mini"),
                CancellationToken.None).AsTask();

        [Fact]
        public async Task Create_StoresTheKeyEncryptedAndReturnsOnlyAMaskedTail()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = NewUserId();

            var dto = await CreateProviderAsync(db, userId);

            var stored = await db.AiProviderSettings.AsNoTracking().SingleAsync(p => p.Id == dto.Id);
            Assert.DoesNotContain(SecretKey, stored.EncryptedApiKey);
            Assert.Equal(SecretKey, _protector.Unprotect(stored.EncryptedApiKey));
            Assert.Equal("****9876", dto.MaskedApiKey);
            Assert.DoesNotContain(SecretKey, System.Text.Json.JsonSerializer.Serialize(dto));
            Assert.False(dto.IsActive);
        }

        [Theory]
        [InlineData("https://127.0.0.1/v1")]
        [InlineData("https://10.0.0.4/v1")]
        [InlineData("https://192.168.0.2/v1")]
        [InlineData("https://169.254.169.254/latest")]
        [InlineData("https://localhost/v1")]
        public async Task Create_WithAPrivateAddress_IsRejectedWithoutPersisting(string baseUrl)
        {
            await using var db = _fixture.CreateDbContext();
            var userId = NewUserId();

            var exception = await Assert.ThrowsAsync<DomainException>(() => CreateProviderAsync(db, userId, baseUrl));

            Assert.Equal(ErrorCodes.AiProviderBaseUrlInvalid, exception.Code);
            Assert.False(await db.AiProviderSettings.AnyAsync(p => p.UserId == userId));
        }

        [Fact]
        public async Task Get_ReturnsOnlyTheProvidersOfTheCurrentUser()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = NewUserId();
            var own = await CreateProviderAsync(db, userId);
            await CreateProviderAsync(db, NewUserId());

            var result = await new GetAiProviders.Handler(db, CurrentUser(userId))
                .Handle(new GetAiProviders.GetAiProvidersQuery(), CancellationToken.None);

            Assert.Equal(own.Id, Assert.Single(result).Id);
        }

        [Fact]
        public async Task Update_WithoutANewKey_KeepsTheStoredKey()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = NewUserId();
            var created = await CreateProviderAsync(db, userId);
            var handler = new UpdateAiProvider.Handler(db, CurrentUser(userId), _protector, _guard);

            var updated = await handler.Handle(
                new UpdateAiProvider.UpdateAiProviderCommand(AiProviderTemplates.Custom, "https://8.8.4.4/v2", null, "other-model") { Id = created.Id },
                CancellationToken.None);

            var stored = await db.AiProviderSettings.AsNoTracking().SingleAsync(p => p.Id == created.Id);
            Assert.Equal(SecretKey, _protector.Unprotect(stored.EncryptedApiKey));
            Assert.Equal("****9876", updated.MaskedApiKey);
            Assert.Equal("other-model", stored.Model);
            Assert.Equal("https://8.8.4.4/v2", stored.BaseUrl);
        }

        [Fact]
        public async Task Update_WithANewKey_ReplacesTheStoredKey()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = NewUserId();
            var created = await CreateProviderAsync(db, userId);
            var handler = new UpdateAiProvider.Handler(db, CurrentUser(userId), _protector, _guard);

            var updated = await handler.Handle(
                new UpdateAiProvider.UpdateAiProviderCommand(AiProviderTemplates.OpenAi, PublicUrl, "brand-new-key-0001", "gpt-4o-mini") { Id = created.Id },
                CancellationToken.None);

            var stored = await db.AiProviderSettings.AsNoTracking().SingleAsync(p => p.Id == created.Id);
            Assert.Equal("brand-new-key-0001", _protector.Unprotect(stored.EncryptedApiKey));
            Assert.Equal("****0001", updated.MaskedApiKey);
        }

        [Fact]
        public async Task Update_OfAnotherUsersProvider_IsNotFound()
        {
            await using var db = _fixture.CreateDbContext();
            var created = await CreateProviderAsync(db, NewUserId());
            var handler = new UpdateAiProvider.Handler(db, CurrentUser(NewUserId()), _protector, _guard);

            var exception = await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(
                new UpdateAiProvider.UpdateAiProviderCommand(AiProviderTemplates.OpenAi, PublicUrl, null, "m") { Id = created.Id },
                CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.AiProviderNotFound, exception.Code);
        }

        [Fact]
        public async Task Delete_OfAnotherUsersProvider_IsNotFoundAndKeepsTheProvider()
        {
            await using var db = _fixture.CreateDbContext();
            var created = await CreateProviderAsync(db, NewUserId());

            await Assert.ThrowsAsync<NotFoundException>(() => new DeleteAiProvider.Handler(db, CurrentUser(NewUserId()))
                .Handle(new DeleteAiProvider.DeleteAiProviderCommand(created.Id), CancellationToken.None).AsTask());

            Assert.True(await db.AiProviderSettings.AnyAsync(p => p.Id == created.Id));
        }

        [Fact]
        public async Task Activate_MarksOnlyTheChosenProviderAsActive()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = NewUserId();
            var first = await CreateProviderAsync(db, userId);
            var second = await CreateProviderAsync(db, userId);
            var handler = new ActivateAiProvider.Handler(db, CurrentUser(userId));

            await handler.Handle(new ActivateAiProvider.ActivateAiProviderCommand(first.Id), CancellationToken.None);
            await handler.Handle(new ActivateAiProvider.ActivateAiProviderCommand(second.Id), CancellationToken.None);

            var active = await db.AiProviderSettings.AsNoTracking().Where(p => p.UserId == userId && p.IsActive).ToListAsync();
            Assert.Equal(second.Id, Assert.Single(active).Id);
        }

        [Fact]
        public async Task Activate_DoesNotTouchTheProvidersOfOtherUsers()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = NewUserId();
            var otherUserId = NewUserId();
            var own = await CreateProviderAsync(db, userId);
            var other = await CreateProviderAsync(db, otherUserId);
            await new ActivateAiProvider.Handler(db, CurrentUser(otherUserId))
                .Handle(new ActivateAiProvider.ActivateAiProviderCommand(other.Id), CancellationToken.None);

            await new ActivateAiProvider.Handler(db, CurrentUser(userId))
                .Handle(new ActivateAiProvider.ActivateAiProviderCommand(own.Id), CancellationToken.None);

            Assert.True((await db.AiProviderSettings.AsNoTracking().SingleAsync(p => p.Id == other.Id)).IsActive);
        }

        [Fact]
        public async Task Delete_OfTheActiveProvider_LeavesNoneActive()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = NewUserId();
            var first = await CreateProviderAsync(db, userId);
            var second = await CreateProviderAsync(db, userId);
            await new ActivateAiProvider.Handler(db, CurrentUser(userId))
                .Handle(new ActivateAiProvider.ActivateAiProviderCommand(first.Id), CancellationToken.None);

            await new DeleteAiProvider.Handler(db, CurrentUser(userId))
                .Handle(new DeleteAiProvider.DeleteAiProviderCommand(first.Id), CancellationToken.None);

            var remaining = await db.AiProviderSettings.AsNoTracking().Where(p => p.UserId == userId).ToListAsync();
            Assert.Equal(second.Id, Assert.Single(remaining).Id);
            Assert.DoesNotContain(remaining, p => p.IsActive);
        }

        [Fact]
        public async Task TestConnection_WithTheStoredKey_UsesItAndChangesNothing()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = NewUserId();
            var created = await CreateProviderAsync(db, userId);
            var chat = new Mock<IAiChatCompletionService>();
            AiProviderCredentials? received = null;
            chat.Setup(c => c.CompleteAsync(It.IsAny<AiProviderCredentials>(), It.IsAny<AiChatRequest>(), It.IsAny<CancellationToken>()))
                .Callback<AiProviderCredentials, AiChatRequest, CancellationToken>((credentials, _, _) => received = credentials)
                .ReturnsAsync(AiChatResult.Success("OK"));
            var handler = new TestAiProviderConnection.Handler(db, CurrentUser(userId), _protector, chat.Object);

            var result = await handler.Handle(
                new TestAiProviderConnection.TestAiProviderConnectionCommand(created.Id, AiProviderTemplates.OpenAi, PublicUrl, null, "gpt-4o-mini"),
                CancellationToken.None);

            Assert.True(result.Success);
            Assert.Null(result.Failure);
            Assert.Equal(SecretKey, received!.ApiKey);
            Assert.Equal(AiProviderType.OpenAiCompatible, received.Type);
            Assert.Equal(1, await db.AiProviderSettings.CountAsync(p => p.UserId == userId));
        }

        [Fact]
        public async Task TestConnection_WithAFormKey_DoesNotCreateAProvider()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = NewUserId();
            var chat = new Mock<IAiChatCompletionService>();
            chat.Setup(c => c.CompleteAsync(It.IsAny<AiProviderCredentials>(), It.IsAny<AiChatRequest>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(AiChatResult.Success("OK"));
            var handler = new TestAiProviderConnection.Handler(db, CurrentUser(userId), _protector, chat.Object);

            await handler.Handle(
                new TestAiProviderConnection.TestAiProviderConnectionCommand(null, AiProviderTemplates.Claude, "https://api.anthropic.com", "typed-key-12345", "claude-sonnet-4-5"),
                CancellationToken.None);

            Assert.False(await db.AiProviderSettings.AnyAsync(p => p.UserId == userId));
            chat.Verify(c => c.CompleteAsync(
                It.Is<AiProviderCredentials>(credentials => credentials.Type == AiProviderType.Claude && credentials.ApiKey == "typed-key-12345"),
                It.IsAny<AiChatRequest>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Theory]
        [InlineData(AiChatFailure.InvalidKey)]
        [InlineData(AiChatFailure.Unreachable)]
        [InlineData(AiChatFailure.UnknownModel)]
        [InlineData(AiChatFailure.QuotaExceeded)]
        [InlineData(AiChatFailure.Timeout)]
        public async Task TestConnection_ReportsTheClassifiedFailure(AiChatFailure failure)
        {
            await using var db = _fixture.CreateDbContext();
            var chat = new Mock<IAiChatCompletionService>();
            chat.Setup(c => c.CompleteAsync(It.IsAny<AiProviderCredentials>(), It.IsAny<AiChatRequest>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(AiChatResult.Failed(failure));
            var handler = new TestAiProviderConnection.Handler(db, CurrentUser(NewUserId()), _protector, chat.Object);

            var result = await handler.Handle(
                new TestAiProviderConnection.TestAiProviderConnectionCommand(null, AiProviderTemplates.OpenAi, PublicUrl, "typed-key-12345", "gpt-4o-mini"),
                CancellationToken.None);

            Assert.False(result.Success);
            Assert.Equal(failure.ToString(), result.Failure);
            Assert.False(string.IsNullOrWhiteSpace(result.Message));
        }

        [Fact]
        public async Task TestConnection_OfAnotherUsersProvider_IsNotFound()
        {
            await using var db = _fixture.CreateDbContext();
            var created = await CreateProviderAsync(db, NewUserId());
            var handler = new TestAiProviderConnection.Handler(db, CurrentUser(NewUserId()), _protector, Mock.Of<IAiChatCompletionService>());

            await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(
                new TestAiProviderConnection.TestAiProviderConnectionCommand(created.Id, AiProviderTemplates.OpenAi, PublicUrl, null, "m"),
                CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task ChatService_WithoutActiveProvider_Fails()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = NewUserId();
            await CreateProviderAsync(db, userId);
            var service = new AiChatCompletionService(db, _protector, _guard, []);

            var result = await service.CompleteAsync(userId, new AiChatRequest([new AiChatMessage(AiChatRoles.User, "hola")]), CancellationToken.None);

            Assert.Equal(AiChatFailure.NoActiveProvider, result.Failure);
        }

        [Fact]
        public async Task ChatService_UsesTheActiveProviderOfTheUserThroughItsAdapter()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = NewUserId();
            var created = await CreateProviderAsync(db, userId);
            await new ActivateAiProvider.Handler(db, CurrentUser(userId))
                .Handle(new ActivateAiProvider.ActivateAiProviderCommand(created.Id), CancellationToken.None);
            AiProviderCredentials? received = null;
            var adapter = new Mock<IAiChatAdapter>();
            adapter.Setup(a => a.Type).Returns(AiProviderType.OpenAiCompatible);
            adapter.Setup(a => a.CompleteAsync(It.IsAny<AiProviderCredentials>(), It.IsAny<AiChatRequest>(), It.IsAny<CancellationToken>()))
                .Callback<AiProviderCredentials, AiChatRequest, CancellationToken>((credentials, _, _) => received = credentials)
                .ReturnsAsync(AiChatResult.Success("respuesta"));
            var service = new AiChatCompletionService(db, _protector, _guard, [adapter.Object]);

            var result = await service.CompleteAsync(userId, new AiChatRequest([new AiChatMessage(AiChatRoles.User, "hola")]), CancellationToken.None);

            Assert.Equal("respuesta", result.Content);
            Assert.Equal(SecretKey, received!.ApiKey);
            Assert.Equal(PublicUrl, received.BaseUrl);
            Assert.Equal("gpt-4o-mini", received.Model);
        }

        [Fact]
        public async Task ChatService_WithAPrivateBaseUrl_NeverCallsTheAdapter()
        {
            await using var db = _fixture.CreateDbContext();
            var adapter = new Mock<IAiChatAdapter>();
            adapter.Setup(a => a.Type).Returns(AiProviderType.OpenAiCompatible);
            var service = new AiChatCompletionService(db, _protector, _guard, [adapter.Object]);
            var credentials = new AiProviderCredentials(AiProviderType.OpenAiCompatible, "https://10.0.0.8/v1", SecretKey, "m");

            var result = await service.CompleteAsync(credentials, new AiChatRequest([new AiChatMessage(AiChatRoles.User, "hola")]), CancellationToken.None);

            Assert.Equal(AiChatFailure.InvalidBaseUrl, result.Failure);
            adapter.Verify(a => a.CompleteAsync(It.IsAny<AiProviderCredentials>(), It.IsAny<AiChatRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task ChatService_WhenTheStoredKeyCannotBeDecrypted_ReportsAnInvalidKey()
        {
            await using var db = _fixture.CreateDbContext();
            var userId = NewUserId();
            var created = await CreateProviderAsync(db, userId);
            await new ActivateAiProvider.Handler(db, CurrentUser(userId))
                .Handle(new ActivateAiProvider.ActivateAiProviderCommand(created.Id), CancellationToken.None);
            var otherKeyRing = new AiApiKeyProtector(new EphemeralDataProtectionProvider());
            var service = new AiChatCompletionService(db, otherKeyRing, _guard, []);

            var result = await service.CompleteAsync(userId, new AiChatRequest([new AiChatMessage(AiChatRoles.User, "hola")]), CancellationToken.None);

            Assert.Equal(AiChatFailure.InvalidKey, result.Failure);
        }
    }
}
