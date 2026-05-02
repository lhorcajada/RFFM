namespace RFFM.Api.Domain.Services
{
    public interface ICurrentUserService
    {
        /// <summary>Identity user ID from JWT nameidentifier claim.</summary>
        string? UserId { get; }

        /// <summary>Primary role of the authenticated user (first role claim).</summary>
        string? Role { get; }

        bool IsAuthenticated { get; }
    }
}
