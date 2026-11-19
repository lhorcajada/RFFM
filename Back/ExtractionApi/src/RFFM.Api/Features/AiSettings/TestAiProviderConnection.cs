using System.Security.Cryptography;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.AiProviders;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.AiSettings.Services;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.AiSettings
{
    /// <summary>
    /// "Probar conexión": sends a minimal request through the chat-completion service and reports a
    /// classified result. It never creates or changes a provider. With an Id and no ApiKey it uses the
    /// stored key of that provider. POST /api/ai-providers/test
    /// </summary>
    public class TestAiProviderConnection : IFeatureModule
    {
        private const string TestPrompt = "Responde solo con la palabra OK.";

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/ai-providers/test",
                    async (TestAiProviderConnectionCommand command, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(command, ct)))
                .WithName(nameof(TestAiProviderConnection))
                .WithTags(AiSettingsConstants.Tag)
                .Produces<TestAiProviderConnectionResult>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .RequireAuthorization();
        }

        public record TestAiProviderConnectionCommand(string? Id, string? Template, string? BaseUrl, string? ApiKey, string? Model)
            : IRequest<TestAiProviderConnectionResult>;

        /// <param name="Failure">Name of the <see cref="AiChatFailure"/> when the test fails, null on success.</param>
        public record TestAiProviderConnectionResult(bool Success, string? Failure, string Message);

        public class Handler : IRequestHandler<TestAiProviderConnectionCommand, TestAiProviderConnectionResult>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;
            private readonly IAiApiKeyProtector _protector;
            private readonly IAiChatCompletionService _chat;

            public Handler(AppDbContext db, ICurrentUserService currentUser, IAiApiKeyProtector protector, IAiChatCompletionService chat)
            {
                _db = db;
                _currentUser = currentUser;
                _protector = protector;
                _chat = chat;
            }

            public async ValueTask<TestAiProviderConnectionResult> Handle(
                TestAiProviderConnectionCommand request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                var apiKey = await ResolveApiKeyAsync(request, userId, cancellationToken);
                if (apiKey is null)
                    return Failed(AiChatFailure.InvalidKey);

                var credentials = new AiProviderCredentials(
                    AiProviderTemplates.TypeFor(request.Template!), request.BaseUrl!.Trim(), apiKey, request.Model!.Trim());
                var chatRequest = new AiChatRequest([new AiChatMessage(AiChatRoles.User, TestPrompt)]);

                var result = await _chat.CompleteAsync(credentials, chatRequest, cancellationToken);

                return result.Failure is { } failure
                    ? Failed(failure)
                    : new TestAiProviderConnectionResult(true, null, "Conexión correcta.");
            }

            private async Task<string?> ResolveApiKeyAsync(TestAiProviderConnectionCommand request, string userId, CancellationToken cancellationToken)
            {
                if (!string.IsNullOrWhiteSpace(request.ApiKey))
                    return request.ApiKey.Trim();

                var provider = await _db.AiProviderSettings
                    .AsNoTracking()
                    .FirstOrDefaultAsync(p => p.Id == request.Id && p.UserId == userId, cancellationToken)
                    ?? throw new NotFoundException("No se encontró el proveedor de IA.", ErrorCodes.AiProviderNotFound);

                try
                {
                    return _protector.Unprotect(provider.EncryptedApiKey);
                }
                catch (CryptographicException)
                {
                    return null;
                }
            }

            private static TestAiProviderConnectionResult Failed(AiChatFailure failure) =>
                new(false, failure.ToString(), AiChatFailureMessages.For(failure));
        }

        public class Validator : AiProviderFieldsValidator<TestAiProviderConnectionCommand>
        {
            public Validator() : base(x => x.Template, x => x.BaseUrl, x => x.Model)
            {
                RuleFor(x => x.ApiKey)
                    .NotEmpty().WithMessage("La clave de API es obligatoria.")
                    .When(x => string.IsNullOrWhiteSpace(x.Id));
                ApiKeyFormat(RuleFor(x => x.ApiKey));
            }
        }
    }
}
