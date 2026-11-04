using Microsoft.AspNetCore.Http;

namespace RFFM.Api.Features.Coaches.LiveMatch
{
    public static class LiveMatchHubAuthentication
    {
        private const string HubsPathPrefix = "/hubs";

        public static bool AllowsQueryStringToken(PathString path)
            => path.StartsWithSegments(HubsPathPrefix, StringComparison.OrdinalIgnoreCase);
    }
}
