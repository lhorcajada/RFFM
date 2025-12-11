using Microsoft.Extensions.Configuration;
using RFFM.Api.Domain.Resources;
using MimeKit;
using MailKit.Net.Smtp;

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
            var host = _configuration["Smtp:Host"] ?? "smtp.gmail.com";
            var port = int.TryParse(_configuration["Smtp:Port"], out var p) ? p : 587;
            var user = _configuration["Smtp:User"];
            var pass = _configuration["Smtp:Password"];
            var fromEmail = _configuration["Smtp:FromEmail"] ?? _configuration["Smtp:User"];
            var fromName = _configuration["Smtp:FromName"] ?? "Futbol Base";

            if (string.IsNullOrEmpty(user) || string.IsNullOrEmpty(pass))
            {
                throw new InvalidOperationException("SMTP configuration is missing (Smtp:User/Smtp:Password)");
            }

            // Obtener el contenido de la plantilla
            var htmlContent = await _emailTemplateService.GetTemplateAsync(templateName, placeholders);

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(fromName, fromEmail));
            message.To.Add(MailboxAddress.Parse(toEmail));
            message.Subject = subject;

            var builder = new BodyBuilder { HtmlBody = htmlContent };
            message.Body = builder.ToMessageBody();

            using var smtp = new SmtpClient();
            try
            {
                await smtp.ConnectAsync(host, port, MailKit.Security.SecureSocketOptions.StartTls);
                await smtp.AuthenticateAsync(user, pass);
                await smtp.SendAsync(message);
            }
            finally
            {
                await smtp.DisconnectAsync(true);
            }
        }
    }
}