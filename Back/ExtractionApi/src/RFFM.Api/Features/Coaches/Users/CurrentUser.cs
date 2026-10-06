using System.Security.Claims;

namespace RFFM.Api.Features.Coaches.Users
{
    public static class CurrentUser
    {
        public static string? GetId(ClaimsPrincipal user) =>
            user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
    }
}
