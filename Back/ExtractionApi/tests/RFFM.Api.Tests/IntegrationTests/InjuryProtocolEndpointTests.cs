#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Encodings.Web;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Teams.InjuryProtocol;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services;
using RFFM.Api.Infrastructure.Storage;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Coverage for SetTeamInjuryProtocol: role-gated writes (Coach/Administrator only) with an
    /// open GET, upsert semantics, "no protocol yet" returning content: null (not 404), and PDF
    /// attachment upload/validation/delete via IStorageService (add-injury-protocol-and-
    /// documents-tabs, design.md Decisión 3). Mirrors SanctionEndpointAuthorizationTests's host
    /// bootstrap — see that file for rationale on using a real Postgres TestServer.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class InjuryProtocolEndpointTests
    {
        private readonly PostgresContainerFixture _fixture;

        public InjuryProtocolEndpointTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
        {
            public const string SchemeName = "Test";

            public TestAuthHandler(
                IOptionsMonitor<AuthenticationSchemeOptions> options,
                ILoggerFactory logger,
                UrlEncoder encoder)
                : base(options, logger, encoder)
            {
            }

            protected override Task<AuthenticateResult> HandleAuthenticateAsync()
            {
                var role = Request.Headers.TryGetValue("X-Test-Role", out var values)
                    ? values.ToString()
                    : string.Empty;

                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.Name, "test-user"),
                };
                if (!string.IsNullOrEmpty(role))
                {
                    claims.Add(new Claim(ClaimTypes.Role, role));
                }

                var identity = new ClaimsIdentity(claims, SchemeName);
                var principal = new ClaimsPrincipal(identity);
                var ticket = new AuthenticationTicket(principal, SchemeName);
                return Task.FromResult(AuthenticateResult.Success(ticket));
            }
        }

        private string _localStorageBasePath = null!;

        private async Task<(IHost Host, HttpClient Client)> StartHostAsync()
        {
            _localStorageBasePath = Path.Combine(Path.GetTempPath(), "rffm-tests-storage", Guid.NewGuid().ToString("N"));

            var host = new HostBuilder()
                .ConfigureWebHost(webBuilder =>
                {
                    webBuilder
                        .UseTestServer()
                        .ConfigureServices(services =>
                        {
                            services.AddRouting();
                            services.AddAuthentication(TestAuthHandler.SchemeName)
                                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
                            services.AddAuthorization();
                            services.AddDbContext<AppDbContext>(options =>
                            {
                                options.UseNpgsql(_fixture.ConnectionString, npgsql =>
                                {
                                    npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "app");
                                });
                            });
                            services.AddHttpContextAccessor();
                            services.AddSingleton<IConfiguration>(new ConfigurationBuilder()
                                .AddInMemoryCollection(new Dictionary<string, string?>
                                {
                                    ["LocalStorage:BasePath"] = _localStorageBasePath
                                })
                                .Build());
                            services.AddScoped<ICurrentUserService, CurrentUserService>();
                            services.AddScoped<IStorageService, LocalStorageService>();
                        })
                        .Configure(app =>
                        {
                            app.UseRouting();
                            app.UseAuthentication();
                            app.UseAuthorization();
                            app.UseEndpoints(endpoints => new SetTeamInjuryProtocol().AddRoutes(endpoints));
                        });
                })
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient());
        }

        private async Task<string> CreateTeamAsync()
        {
            await using var setupDb = _fixture.CreateDbContext();

            var club = Club.Create($"Injury Protocol Test Club {Guid.NewGuid():N}", 1);
            setupDb.Clubs.Add(club);
            await setupDb.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}",
                DateTime.UtcNow,
                DateTime.UtcNow.AddMonths(9),
                isActive: true,
                club: club);
            setupDb.Seasons.Add(season);
            await setupDb.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Injury Protocol Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            setupDb.Teams.Add(team);
            await setupDb.SaveChangesAsync();

            return team.Id;
        }

        private static HttpRequestMessage BuildPdfUploadRequest(string teamId, byte[] content, string fileName = "protocolo.pdf", string contentType = "application/pdf")
        {
            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/team/{teamId}/injury-protocol/attachments");
            var multipart = new MultipartFormDataContent();
            var fileContent = new ByteArrayContent(content);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue(contentType);
            multipart.Add(fileContent, "file", fileName);
            request.Content = multipart;
            return request;
        }

        [Fact]
        public async Task GetInjuryProtocol_WithoutExistingProtocol_ReturnsNullContent()
        {
            var teamId = await CreateTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/catalog/team/{teamId}/injury-protocol");
            request.Headers.Add("X-Test-Role", "Player");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<SetTeamInjuryProtocol.InjuryProtocolResponse>();
            Assert.NotNull(body);
            Assert.Null(body!.Content);
            Assert.Empty(body.Attachments);
        }

        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task UpdateInjuryProtocol_WithDisallowedRole_ReturnsForbidden(string role)
        {
            var teamId = await CreateTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Put, $"/api/catalog/team/{teamId}/injury-protocol")
            {
                Content = JsonContent.Create(new SetTeamInjuryProtocol.UpdateInjuryProtocolRequest("<p>Protocolo</p>"))
            };
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task UpdateInjuryProtocol_WithCoachRole_UpsertsSuccessfully()
        {
            var teamId = await CreateTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Put, $"/api/catalog/team/{teamId}/injury-protocol")
            {
                Content = JsonContent.Create(new SetTeamInjuryProtocol.UpdateInjuryProtocolRequest("<p>Llamar al 112</p>"))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<SetTeamInjuryProtocol.InjuryProtocolResponse>();
            Assert.Equal("<p>Llamar al 112</p>", body!.Content);

            var getRequest = new HttpRequestMessage(HttpMethod.Get, $"/api/catalog/team/{teamId}/injury-protocol");
            getRequest.Headers.Add("X-Test-Role", "Player");
            var getResponse = await client.SendAsync(getRequest);
            var getBody = await getResponse.Content.ReadFromJsonAsync<SetTeamInjuryProtocol.InjuryProtocolResponse>();
            Assert.Equal("<p>Llamar al 112</p>", getBody!.Content);
        }

        [Fact]
        public async Task UpdateInjuryProtocol_CalledTwice_UpdatesSameRowInsteadOfDuplicating()
        {
            var teamId = await CreateTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            async Task<HttpResponseMessage> Put(string content)
            {
                var req = new HttpRequestMessage(HttpMethod.Put, $"/api/catalog/team/{teamId}/injury-protocol")
                {
                    Content = JsonContent.Create(new SetTeamInjuryProtocol.UpdateInjuryProtocolRequest(content))
                };
                req.Headers.Add("X-Test-Role", "Coach");
                return await client.SendAsync(req);
            }

            await Put("<p>Primero</p>");
            var second = await Put("<p>Segundo</p>");

            Assert.Equal(HttpStatusCode.OK, second.StatusCode);
            var body = await second.Content.ReadFromJsonAsync<SetTeamInjuryProtocol.InjuryProtocolResponse>();
            Assert.Equal("<p>Segundo</p>", body!.Content);

            await using var db = _fixture.CreateDbContext();
            var count = await db.TeamInjuryProtocols.CountAsync(p => p.TeamId == teamId);
            Assert.Equal(1, count);
        }

        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task DeleteInjuryProtocol_WithDisallowedRole_ReturnsForbidden(string role)
        {
            var teamId = await CreateTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/catalog/team/{teamId}/injury-protocol");
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task DeleteInjuryProtocol_WithCoachRole_ClearsContentButKeepsAttachments()
        {
            var teamId = await CreateTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var putRequest = new HttpRequestMessage(HttpMethod.Put, $"/api/catalog/team/{teamId}/injury-protocol")
            {
                Content = JsonContent.Create(new SetTeamInjuryProtocol.UpdateInjuryProtocolRequest("<p>Contenido</p>"))
            };
            putRequest.Headers.Add("X-Test-Role", "Coach");
            await client.SendAsync(putRequest);

            var uploadRequest = BuildPdfUploadRequest(teamId, Encoding.UTF8.GetBytes("%PDF-1.4 fake"));
            uploadRequest.Headers.Add("X-Test-Role", "Coach");
            var uploadResponse = await client.SendAsync(uploadRequest);
            Assert.Equal(HttpStatusCode.Created, uploadResponse.StatusCode);

            var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, $"/api/catalog/team/{teamId}/injury-protocol");
            deleteRequest.Headers.Add("X-Test-Role", "Coach");
            var deleteResponse = await client.SendAsync(deleteRequest);
            Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

            var getRequest = new HttpRequestMessage(HttpMethod.Get, $"/api/catalog/team/{teamId}/injury-protocol");
            getRequest.Headers.Add("X-Test-Role", "Player");
            var getResponse = await client.SendAsync(getRequest);
            var body = await getResponse.Content.ReadFromJsonAsync<SetTeamInjuryProtocol.InjuryProtocolResponse>();

            Assert.Null(body!.Content);
            Assert.Single(body.Attachments);
        }

        [Fact]
        public async Task UploadAttachment_WithValidPdf_CreatesAttachmentAndPersistsIt()
        {
            var teamId = await CreateTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var request = BuildPdfUploadRequest(teamId, Encoding.UTF8.GetBytes("%PDF-1.4 fake content"));
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<SetTeamInjuryProtocol.InjuryProtocolAttachmentResponse>();
            Assert.NotNull(body);
            Assert.Equal("protocolo.pdf", body!.FileName);
            Assert.False(string.IsNullOrWhiteSpace(body.Url));

            var getRequest = new HttpRequestMessage(HttpMethod.Get, $"/api/catalog/team/{teamId}/injury-protocol");
            getRequest.Headers.Add("X-Test-Role", "Player");
            var getResponse = await client.SendAsync(getRequest);
            var getBody = await getResponse.Content.ReadFromJsonAsync<SetTeamInjuryProtocol.InjuryProtocolResponse>();
            Assert.Single(getBody!.Attachments);
        }

        [Fact]
        public async Task UploadAttachment_WithNonPdfContentType_ReturnsBadRequest()
        {
            var teamId = await CreateTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var request = BuildPdfUploadRequest(teamId, Encoding.UTF8.GetBytes("not a pdf"), "image.png", "image/png");
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task UploadAttachment_WithDisallowedRole_ReturnsForbidden(string role)
        {
            var teamId = await CreateTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var request = BuildPdfUploadRequest(teamId, Encoding.UTF8.GetBytes("%PDF-1.4 fake"));
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task DeleteAttachment_WithCoachRole_RemovesItFromListing()
        {
            var teamId = await CreateTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var uploadRequest = BuildPdfUploadRequest(teamId, Encoding.UTF8.GetBytes("%PDF-1.4 fake"));
            uploadRequest.Headers.Add("X-Test-Role", "Coach");
            var uploadResponse = await client.SendAsync(uploadRequest);
            var uploaded = await uploadResponse.Content.ReadFromJsonAsync<SetTeamInjuryProtocol.InjuryProtocolAttachmentResponse>();

            var deleteRequest = new HttpRequestMessage(
                HttpMethod.Delete, $"/api/catalog/team/{teamId}/injury-protocol/attachments/{uploaded!.Id}");
            deleteRequest.Headers.Add("X-Test-Role", "Coach");
            var deleteResponse = await client.SendAsync(deleteRequest);

            Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

            var getRequest = new HttpRequestMessage(HttpMethod.Get, $"/api/catalog/team/{teamId}/injury-protocol");
            getRequest.Headers.Add("X-Test-Role", "Player");
            var getResponse = await client.SendAsync(getRequest);
            var getBody = await getResponse.Content.ReadFromJsonAsync<SetTeamInjuryProtocol.InjuryProtocolResponse>();
            Assert.Empty(getBody!.Attachments);
        }

        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task DeleteAttachment_WithDisallowedRole_ReturnsForbidden(string role)
        {
            var teamId = await CreateTeamAsync();
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var uploadRequest = BuildPdfUploadRequest(teamId, Encoding.UTF8.GetBytes("%PDF-1.4 fake"));
            uploadRequest.Headers.Add("X-Test-Role", "Coach");
            var uploadResponse = await client.SendAsync(uploadRequest);
            var uploaded = await uploadResponse.Content.ReadFromJsonAsync<SetTeamInjuryProtocol.InjuryProtocolAttachmentResponse>();

            var deleteRequest = new HttpRequestMessage(
                HttpMethod.Delete, $"/api/catalog/team/{teamId}/injury-protocol/attachments/{uploaded!.Id}");
            deleteRequest.Headers.Add("X-Test-Role", role);
            var deleteResponse = await client.SendAsync(deleteRequest);

            Assert.Equal(HttpStatusCode.Forbidden, deleteResponse.StatusCode);
        }
    }
}
