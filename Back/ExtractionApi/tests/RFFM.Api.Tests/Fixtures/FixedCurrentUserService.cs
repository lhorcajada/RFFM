#nullable enable
using RFFM.Api.Domain.Services;

namespace RFFM.Api.Tests.Fixtures
{
    /// <summary>
    /// Test double for <see cref="ICurrentUserService"/> that reports a fixed user id.
    /// A null id means no authenticated user.
    /// </summary>
    public sealed class FixedCurrentUserService(string? userId) : ICurrentUserService
    {
        public string? UserId => userId;

        public string? Role => null;

        public IEnumerable<string> Roles => Array.Empty<string>();

        public bool IsAuthenticated => userId is not null;
    }
}
