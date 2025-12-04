namespace RFFM.Api.Infrastructure.Services.Email
{
    public class EmailTemplateService
    {
        private readonly string _templatePath;

        public EmailTemplateService(string templatePath)
        {
            _templatePath = templatePath;
        }

        public async Task<string> GetTemplateAsync(string templateName, Dictionary<string, string> placeholders)
        {
            var templateFilePath = Path.Combine(_templatePath, $"{templateName}.html");

            if (!File.Exists(templateFilePath))
            {
                throw new FileNotFoundException($"La plantilla '{templateName}' no se encontró en la ruta '{_templatePath}'.");
            }

            var templateContent = await File.ReadAllTextAsync(templateFilePath);

            // Reemplazar los marcadores con valores
            foreach (var placeholder in placeholders)
            {
                templateContent = templateContent.Replace($"{{{{ {placeholder.Key} }}}}", placeholder.Value);
            }

            return templateContent;
        }
    }
}