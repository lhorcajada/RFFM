using Microsoft.AspNetCore.Identity;

namespace RFFM.Api.Infrastructure.Services.Email
{
    public interface IUserRegistrationEmailService
    {
        Task NotifyAdminForApprovalAsync(IdentityUser user, string token, CancellationToken cancellationToken = default);
    }
}