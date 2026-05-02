using Microsoft.AspNetCore.Http;
using RFFM.Api.Domain.Services;

namespace RFFM.Api.Infrastructure.Services
{
    public class CurrentUserService : ICurrentUserService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public CurrentUserService(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        public string? UserId =>
            _httpContextAccessor.HttpContext?.User.Claims
                .FirstOrDefault(c =>
                    c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier" ||
                    c.Type == "sub")
                ?.Value;

        public string? Role =>
            _httpContextAccessor.HttpContext?.User.Claims
                .FirstOrDefault(c => c.Type == "roles" || c.Type == System.Security.Claims.ClaimTypes.Role)
                ?.Value;

        public bool IsAuthenticated =>
            _httpContextAccessor.HttpContext?.User.Identity?.IsAuthenticated == true;
    }
}
