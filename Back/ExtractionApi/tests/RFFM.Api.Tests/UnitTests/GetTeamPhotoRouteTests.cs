using System.Linq;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Features.Coaches.Teams.Queries;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// GET /api/catalog/team/photo must stay anonymous: it is the only way a plain
    /// &lt;img src&gt; tag (which cannot attach an Authorization header) can render a
    /// team shield stored via LocalStorageService, whose UploadAsync/UploadBytesAsync
    /// return a bare "{bucket}/{file}" relative path instead of a public URL.
    /// </summary>
    public class GetTeamPhotoRouteTests
    {
        [Fact]
        public void GetTeamPhoto_Route_DoesNotRequireAuthorization()
        {
            var builder = WebApplication.CreateBuilder();
            var app = builder.Build();

            new GetTeamPhoto().AddRoutes(app);

            var endpoint = ((IEndpointRouteBuilder)app).DataSources
                .SelectMany(ds => ds.Endpoints)
                .OfType<RouteEndpoint>()
                .Single(e => e.RoutePattern.RawText == "api/catalog/team/photo");

            Assert.Null(endpoint.Metadata.GetMetadata<IAuthorizeData>());
        }
    }
}
