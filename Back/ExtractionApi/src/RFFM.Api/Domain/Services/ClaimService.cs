using System.Security.Claims;
using Microsoft.AspNetCore.Identity;

namespace RFFM.Api.Domain.Services
{
    public static class ClaimService
    {
        public static Claim[] GetClaims(IdentityUser user)
        {
            return [
                new Claim(ClaimTypes.NameIdentifier, user.Id),
                new Claim(ClaimTypes.Name, user.UserName),
                new Claim(ClaimTypes.Email, user.Email ?? string.Empty),
                new Claim("role", "user")
            ];
        }
    }
}
