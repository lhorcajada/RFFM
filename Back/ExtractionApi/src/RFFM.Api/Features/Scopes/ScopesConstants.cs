using Microsoft.AspNetCore.Http;

namespace RFFM.Api.Features.Scopes
{
    public static class ScopesConstants
    {
        public const string ScopesFeature = "ScopesFeature";
        public const string CachePrefix = ScopesFeature;
    }

    public static class ScopeKinds
    {
        public const string Club = "club";
        public const string Team = "team";

        public static bool IsValid(string? kind) =>
            kind == Club || kind == Team;
    }

    public sealed class ScopeAuthorizationResult
    {
        public bool Authorized { get; init; }
        public int Status { get; init; }
        public string Title { get; init; } = string.Empty;
        public string Detail { get; init; } = string.Empty;
        public ScopeContext? Scope { get; init; }

        public static ScopeAuthorizationResult Ok(ScopeContext scope) => new()
        {
            Authorized = true,
            Status = StatusCodes.Status200OK,
            Scope = scope
        };

        public static ScopeAuthorizationResult Fail(int status, string title, string detail) => new()
        {
            Authorized = false,
            Status = status,
            Title = title,
            Detail = detail
        };
    }

    public sealed class ScopeContext
    {
        public string Kind { get; init; } = string.Empty;
        public string Id { get; init; } = string.Empty;
        public string Name { get; init; } = string.Empty;
        public string? ParentClubId { get; init; }
    }

    public sealed record ActiveScopeInfo(string Kind, string Id, string Name);
}