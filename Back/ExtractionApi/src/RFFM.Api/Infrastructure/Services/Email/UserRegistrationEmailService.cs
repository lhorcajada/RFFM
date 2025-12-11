using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;

namespace RFFM.Api.Infrastructure.Services.Email
{
    public class UserRegistrationEmailService : IUserRegistrationEmailService
    {
        private readonly EmailService _emailService;
        private readonly IConfiguration _configuration;

        public UserRegistrationEmailService(EmailService emailService, IConfiguration configuration)
        {
            _emailService = emailService;
            _configuration = configuration;
        }

        public async Task NotifyAdminForApprovalAsync(IdentityUser user, string token, CancellationToken cancellationToken = default)
        {
            var apiBase = _configuration["ApiBase"]?.TrimEnd('/') ?? _configuration["FrontUrlBase"]?.TrimEnd('/') ?? string.Empty;
            var confirmUrl = !string.IsNullOrEmpty(apiBase)
                ? $"{apiBase}/api/users/confirm?userId={user.Id}&token={Uri.EscapeDataString(token)}"
                : $"/api/users/confirm?userId={user.Id}&token={Uri.EscapeDataString(token)}";

            var placeholders = new Dictionary<string, string>
            {
                ["UserName"] = user.UserName ?? string.Empty,
                ["UserEmail"] = user.Email ?? string.Empty,
                ["ConfirmUrl"] = confirmUrl
            };

            var subject = "Aprobación de nuevo usuario - Futbol Base";

            var adminEmail = (_configuration["Seed:AdminEmail"] ?? _configuration["Smtp:FromEmail"] ?? _configuration["AdminEmail"])?.Trim();
            if (string.IsNullOrWhiteSpace(adminEmail))
            {
                throw new InvalidOperationException("No admin email configured for user registration notifications.");
            }

            await _emailService.SendEmailAsync(adminEmail!, subject, "ConfirmUserTemplate", placeholders);
        }
    }
}