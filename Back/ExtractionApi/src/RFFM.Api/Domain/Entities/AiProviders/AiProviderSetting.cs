namespace RFFM.Api.Domain.Entities.AiProviders
{
    public class AiProviderSetting : BaseEntity
    {
        public static class Rules
        {
            public const int BaseUrlMaxLength = 500;
            public const int ModelMaxLength = 200;
            public const int ApiKeyMinLength = 8;
            public const int ApiKeyMaxLength = 500;
            public const int ApiKeyTailLength = 4;
        }

        public string UserId { get; private set; } = null!;
        public string Template { get; private set; } = null!;
        public string BaseUrl { get; private set; } = null!;
        public string Model { get; private set; } = null!;
        public string EncryptedApiKey { get; private set; } = null!;
        public string ApiKeyTail { get; private set; } = null!;
        public bool IsActive { get; private set; }
        public DateTime CreatedAt { get; private set; }
        public DateTime UpdatedAt { get; private set; }

        public AiProviderType Type => AiProviderTemplates.TypeFor(Template);

        private AiProviderSetting() { }

        public static AiProviderSetting Create(
            string userId, string template, string baseUrl, string model, string encryptedApiKey, string apiKeyTail)
        {
            if (string.IsNullOrWhiteSpace(userId))
                throw new ArgumentException("El usuario es obligatorio.");

            var now = DateTime.UtcNow;
            var setting = new AiProviderSetting
            {
                UserId = userId,
                CreatedAt = now
            };
            setting.Update(template, baseUrl, model);
            setting.ReplaceApiKey(encryptedApiKey, apiKeyTail);
            return setting;
        }

        public void Update(string template, string baseUrl, string model)
        {
            if (!AiProviderTemplates.IsKnown(template))
                throw new ArgumentException("La plantilla del proveedor no es válida.");
            if (string.IsNullOrWhiteSpace(baseUrl))
                throw new ArgumentException("La URL base es obligatoria.");
            if (string.IsNullOrWhiteSpace(model))
                throw new ArgumentException("El modelo es obligatorio.");

            Template = template;
            BaseUrl = baseUrl.Trim();
            Model = model.Trim();
            UpdatedAt = DateTime.UtcNow;
        }

        public void ReplaceApiKey(string encryptedApiKey, string apiKeyTail)
        {
            if (string.IsNullOrWhiteSpace(encryptedApiKey))
                throw new ArgumentException("La clave de API es obligatoria.");

            EncryptedApiKey = encryptedApiKey;
            ApiKeyTail = apiKeyTail;
            UpdatedAt = DateTime.UtcNow;
        }

        public void SetActive(bool isActive)
        {
            IsActive = isActive;
            UpdatedAt = DateTime.UtcNow;
        }
    }
}
