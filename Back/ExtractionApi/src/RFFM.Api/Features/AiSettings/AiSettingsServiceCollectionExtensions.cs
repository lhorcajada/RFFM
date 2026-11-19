using FluentValidation;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RFFM.Api.Features.AiSettings.Services;

namespace RFFM.Api.Features.AiSettings
{
    public static class AiSettingsServiceCollectionExtensions
    {
        private static readonly TimeSpan ProviderTimeout = TimeSpan.FromSeconds(30);

        public static IServiceCollection AddAiSettings(this IServiceCollection services, IConfiguration configuration)
        {
            var dataProtection = services.AddDataProtection();
            var keysPath = configuration["DataProtection:KeysPath"];
            if (!string.IsNullOrWhiteSpace(keysPath))
                dataProtection.PersistKeysToFileSystem(new DirectoryInfo(keysPath));

            services.AddHttpClient<OpenAiCompatibleChatAdapter>(client => client.Timeout = ProviderTimeout)
                .ConfigurePrimaryHttpMessageHandler(AiHttpHandlerFactory.Create);
            services.AddHttpClient<ClaudeChatAdapter>(client => client.Timeout = ProviderTimeout)
                .ConfigurePrimaryHttpMessageHandler(AiHttpHandlerFactory.Create);
            services.AddTransient<IAiChatAdapter>(sp => sp.GetRequiredService<OpenAiCompatibleChatAdapter>());
            services.AddTransient<IAiChatAdapter>(sp => sp.GetRequiredService<ClaudeChatAdapter>());

            services.AddSingleton<IAiBaseUrlGuard, AiBaseUrlGuard>();
            services.AddSingleton<IAiApiKeyProtector, AiApiKeyProtector>();
            services.AddScoped<IAiChatCompletionService, AiChatCompletionService>();

            services.AddScoped<IValidator<CreateAiProvider.CreateAiProviderCommand>, CreateAiProvider.Validator>();
            services.AddScoped<IValidator<UpdateAiProvider.UpdateAiProviderCommand>, UpdateAiProvider.Validator>();
            services.AddScoped<IValidator<TestAiProviderConnection.TestAiProviderConnectionCommand>, TestAiProviderConnection.Validator>();

            return services;
        }
    }
}
