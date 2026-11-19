namespace RFFM.Api.Features.Coaches.GameModels.Assistant
{
    public sealed class GameModelAssistantOptions
    {
        public const string SectionName = "GameModelAssistant";

        public int MaxClarifyingRounds { get; set; } = 2;
        public int MaxContextCharacters { get; set; } = 60000;
        public int MaxOutputTokens { get; set; } = 4096;
        public int SessionWindowDays { get; set; } = 30;
        public int MaxMessages { get; set; } = 40;
        public int MaxMessageLength { get; set; } = 4000;
    }
}
