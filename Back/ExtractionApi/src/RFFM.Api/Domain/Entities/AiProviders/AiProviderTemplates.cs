namespace RFFM.Api.Domain.Entities.AiProviders
{
    public enum AiProviderType
    {
        Claude,
        OpenAiCompatible
    }

    public static class AiProviderTemplates
    {
        public const string Claude = "claude";
        public const string OpenAi = "openai";
        public const string Gemini = "gemini";
        public const string Custom = "custom";

        private static readonly HashSet<string> Known = new() { Claude, OpenAi, Gemini, Custom };

        public static bool IsKnown(string? template) => template is not null && Known.Contains(template);

        public static AiProviderType TypeFor(string template) =>
            template == Claude ? AiProviderType.Claude : AiProviderType.OpenAiCompatible;
    }
}
