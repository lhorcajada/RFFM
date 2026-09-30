using System.Reflection;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;

namespace RFFM.Api.Features.Infrastructure
{
    public class GetApiVersion : IFeatureModule
    {
        private const int ShortCommitLength = 7;

        public record ApiVersionDto(string Version, string? Commit);

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            var informationalVersion = typeof(GetApiVersion).Assembly
                .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "0.0.0";
            var version = Parse(informationalVersion);

            app.MapGet("/api/version", () => Results.Ok(version))
                .WithName(nameof(GetApiVersion))
                .WithTags("Version")
                .AllowAnonymous()
                .Produces<ApiVersionDto>(StatusCodes.Status200OK);
        }

        public static ApiVersionDto Parse(string informationalVersion)
        {
            var parts = informationalVersion.Split('+', 2);
            var commit = parts.Length > 1 && parts[1].Length > 0 ? parts[1] : null;
            if (commit is { Length: > ShortCommitLength })
                commit = commit[..ShortCommitLength];
            return new ApiVersionDto(parts[0], commit);
        }
    }
}
