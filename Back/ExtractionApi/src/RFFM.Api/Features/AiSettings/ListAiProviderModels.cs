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
    /// Lists the models the given key can use, so the user picks one instead of typing it. With an Id and no
    /// ApiKey it uses the stored key of that provider. It never creates or changes a provider.
    /// POST /api/ai-providers/models
    /// </summary>
    public class ListAiProviderModels : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/ai-providers/models",
                    async (ListAiProviderModelsCommand command, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(command, ct)))
                .WithName(nameof(ListAiProviderModels))
                .WithTags(AiSettingsConstants.Tag)
                .Produces<ListAiProviderModelsResult>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .RequireAuthorization();
        }

        public record ListAiProviderModelsCommand(string? Id, string? Template, string? BaseUrl, string? ApiKey)
            : IRequest<ListAiProviderModelsResult>;

        /// <param name="Failure">Name of the <see cref="AiChatFailure"/> when listing fails, null on success.</param>
        public record ListAiProviderModelsResult(bool Success, string? Failure, string Message, IReadOnlyList<string> Models);

        public class Handler : IRequestHandler<ListAiProviderModelsCommand, ListAiProviderModelsResult>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;
            private readonly IAiApiKeyProtector _protector;
            private readonly IAiModelCatalogService _catalog;

            public Handler(AppDbContext db, ICurrentUserService currentUser, IAiApiKeyProtector protector, IAiModelCatalogService catalog)
            {
                _db = db;
                _currentUser = currentUser;
                _protector = protector;
                _catalog = catalog;
            }

            public async ValueTask<ListAiProviderModelsResult> Handle(
                ListAiProviderModelsCommand request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                var apiKey = await ResolveApiKeyAsync(request, userId, cancellationToken);
                if (apiKey is null)
                    return Failed(AiChatFailure.InvalidKey);

                var credentials = new AiProviderCredentials(
                    AiProviderTemplates.TypeFor(request.Template!), request.BaseUrl!.Trim(), apiKey, string.Empty);

                var result = await _catalog.ListAsync(request.Template!, credentials, cancellationToken);

                return result.Failure is { } failure
                    ? Failed(failure)
                    : new ListAiProviderModelsResult(true, null, string.Empty, result.Models ?? []);
            }

            private async Task<string?> ResolveApiKeyAsync(ListAiProviderModelsCommand request, string userId, CancellationToken cancellationToken)
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

            private static ListAiProviderModelsResult Failed(AiChatFailure failure) =>
                new(false, failure.ToString(), AiChatFailureMessages.For(failure), []);
        }

        public class Validator : AbstractValidator<ListAiProviderModelsCommand>
        {
            public Validator()
            {
                RuleFor(x => x.Template).Cascade(CascadeMode.Stop)
                    .NotEmpty().WithMessage("La plantilla o el tipo de proveedor es obligatorio.")
                    .Must(AiProviderTemplates.IsKnown).WithMessage("La plantilla del proveedor no es válida.");

                RuleFor(x => x.BaseUrl).Cascade(CascadeMode.Stop)
                    .NotEmpty().WithMessage("La URL base es obligatoria.")
                    .MaximumLength(AiProviderSetting.Rules.BaseUrlMaxLength).WithMessage("La URL base es demasiado larga.")
                    .Must(AiBaseUrlGuard.IsHttpsUrl).WithMessage(AiSettingsConstants.BaseUrlRule);

                RuleFor(x => x.ApiKey)
                    .NotEmpty().WithMessage("La clave de API es obligatoria.")
                    .When(x => string.IsNullOrWhiteSpace(x.Id));
                RuleFor(x => x.ApiKey)
                    .MinimumLength(AiProviderSetting.Rules.ApiKeyMinLength).WithMessage("La clave de API es demasiado corta.")
                    .MaximumLength(AiProviderSetting.Rules.ApiKeyMaxLength).WithMessage("La clave de API es demasiado larga.")
                    .When(x => !string.IsNullOrWhiteSpace(x.ApiKey));
            }
        }
    }
}
