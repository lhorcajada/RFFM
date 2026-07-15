namespace RFFM.Api.Domain.Services
{
    public interface ICurrentUserService
    {
        /// <summary>Identity user ID from JWT nameidentifier claim.</summary>
        string? UserId { get; }

        /// <summary>Primary role of the authenticated user (first role claim).</summary>
        string? Role { get; }

        /// <summary>All role claims of the authenticated user (supports multi-role users).</summary>
        IEnumerable<string> Roles { get; }

        bool IsAuthenticated { get; }
    }
}
