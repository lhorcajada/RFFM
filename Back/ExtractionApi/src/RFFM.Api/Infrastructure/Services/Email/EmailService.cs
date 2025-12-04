using Microsoft.Extensions.Configuration;
using RFFM.Api.Domain.Resources;
using SendGrid;
using SendGrid.Helpers.Mail;

namespace RFFM.Api.Infrastructure.Services.Email
{
    public class EmailService
    {
        private readonly IConfiguration _configuration;
        private readonly EmailTemplateService _emailTemplateService;

        public EmailService(IConfiguration configuration, EmailTemplateService emailTemplateService)
        {
            _configuration = configuration;
            _emailTemplateService = emailTemplateService;
        }

        public async Task SendEmailAsync(string toEmail, string subject, string templateName, Dictionary<string, string> placeholders)
        {
            var apiKey = _configuration["SendGrid:ApiKey"];
            var fromEmail = _configuration["SendGrid:FromEmail"];
            var fromName = _configuration["SendGrid:FromName"];

            var client = new SendGridClient(apiKey);
            var from = new EmailAddress(fromEmail, fromName);
            var to = new EmailAddress(toEmail);

            // Obtener el contenido de la plantilla
            var htmlContent = await _emailTemplateService.GetTemplateAsync(templateName, placeholders);

            var msg = MailHelper.CreateSingleEmail(from, to, subject, null, htmlContent);
            var response = await client.SendEmailAsync(msg);

            if (!response.IsSuccessStatusCode)
            {
                // Manejar errores de SendGrid
                throw new Exception($"{CodeMessages.EmailErrorSending.Message}: {response.StatusCode}");
            }
        }
    }
}