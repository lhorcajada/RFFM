using System.Linq.Expressions;
using FluentValidation;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.AiProviders;
using RFFM.Api.Features.AiSettings.Services;

namespace RFFM.Api.Features.AiSettings
{
    public static class AiSettingsConstants
    {
        public const string Tag = "AiSettings";
        public const string Title = "Ajustes de IA";
        public const string BaseUrlRule = "La URL base debe ser una dirección https válida.";
    }

    /// <summary>Provider data returned to the browser. The API key is never included, only a masked tail.</summary>
    public record AiProviderDto(string Id, string Template, string BaseUrl, string Model, string MaskedApiKey, bool IsActive)
    {
        public static AiProviderDto From(AiProviderSetting setting) => new(
            setting.Id,
            setting.Template,
            setting.BaseUrl,
            setting.Model,
            AiApiKeyMask.Mask(setting.ApiKeyTail),
            setting.IsActive);
    }

    public abstract class AiProviderFieldsValidator<T> : AbstractValidator<T>
    {
        protected AiProviderFieldsValidator(
            Expression<Func<T, string?>> template,
            Expression<Func<T, string?>> baseUrl,
            Expression<Func<T, string?>> model)
        {
            RuleFor(template).Cascade(CascadeMode.Stop)
                .NotEmpty().WithMessage("La plantilla o el tipo de proveedor es obligatorio.")
                .Must(AiProviderTemplates.IsKnown).WithMessage("La plantilla del proveedor no es válida.");

            RuleFor(baseUrl).Cascade(CascadeMode.Stop)
                .NotEmpty().WithMessage("La URL base es obligatoria.")
                .MaximumLength(AiProviderSetting.Rules.BaseUrlMaxLength).WithMessage("La URL base es demasiado larga.")
                .Must(AiBaseUrlGuard.IsHttpsUrl).WithMessage(AiSettingsConstants.BaseUrlRule);

            RuleFor(model).Cascade(CascadeMode.Stop)
                .NotEmpty().WithMessage("El modelo es obligatorio.")
                .MaximumLength(AiProviderSetting.Rules.ModelMaxLength).WithMessage("El nombre del modelo es demasiado largo.");
        }

        protected static IRuleBuilderOptions<T, string?> ApiKeyFormat(IRuleBuilder<T, string?> rule) => rule
            .MinimumLength(AiProviderSetting.Rules.ApiKeyMinLength).WithMessage("La clave de API es demasiado corta.")
            .MaximumLength(AiProviderSetting.Rules.ApiKeyMaxLength).WithMessage("La clave de API es demasiado larga.");
    }

    internal static class AiBaseUrlGuardExtensions
    {
        /// <summary>Rejects a base URL that resolves to a private, loopback or link-local address.</summary>
        public static async Task EnsureAllowedAsync(this IAiBaseUrlGuard guard, string baseUrl, CancellationToken cancellationToken)
        {
            var verdict = await guard.CheckAsync(baseUrl, cancellationToken);
            if (verdict is AiBaseUrlVerdict.Allowed or AiBaseUrlVerdict.Unresolvable)
                return;

            throw new DomainException(
                AiSettingsConstants.Title,
                AiChatFailureMessages.For(AiChatFailure.InvalidBaseUrl),
                ErrorCodes.AiProviderBaseUrlInvalid);
        }
    }
}
