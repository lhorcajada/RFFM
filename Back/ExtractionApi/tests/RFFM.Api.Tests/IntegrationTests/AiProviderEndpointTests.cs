#nullable enable
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using Mediator;
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
using Hellang.Middleware.ProblemDetails;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.DependencyInjection;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.AiSettings;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// HTTP-level coverage of the AI provider settings endpoints (openspec change
    /// ai-provider-settings): authentication, validation messages, and the guarantee that the API
    /// key is never returned.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class AiProviderEndpointTests
    {
        private const string SecretKey = "sk-endpoint-secret-5555";
        private const string UserHeader = "X-Test-User";

        private readonly PostgresContainerFixture _fixture;

        public AiProviderEndpointTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
        {
            public const string SchemeName = "Test";

            public TestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
                : base(options, logger, encoder)
            {
            }

            protected override Task<AuthenticateResult> HandleAuthenticateAsync()
            {
                if (!Request.Headers.TryGetValue(UserHeader, out var userId))
                    return Task.FromResult(AuthenticateResult.NoResult());

                var identity = new ClaimsIdentity(
                    [new Claim("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier", userId.ToString())],
                    SchemeName);
                return Task.FromResult(AuthenticateResult.Success(
                    new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
            }
        }

        private async Task<IHost> StartHostAsync()
        {
            var host = new HostBuilder()
                .ConfigureWebHost(webBuilder =>
                {
                    webBuilder
                        .UseTestServer()
                        .ConfigureServices(services =>
                        {
                            services.AddRouting();
                            services.AddControllers();
                            services.AddAuthentication(TestAuthHandler.SchemeName)
                                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
                            services.AddAuthorization();
                            services.AddDbContext<AppDbContext>(options =>
                                options.UseNpgsql(_fixture.ConnectionString, npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "app")));
                            services.AddHttpContextAccessor();
                            services.AddScoped<ICurrentUserService, CurrentUserService>();

                            services.AddCustomProblemDetails()
                                .AddMediator(o => { o.ServiceLifetime = ServiceLifetime.Scoped; });
                            services
                                .AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>))
                                .AddTransient(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));

                            services.AddAiSettings(new ConfigurationBuilder().Build());
                        })
                        .Configure(app =>
                        {
                            app.UseProblemDetails();
                            app.UseRouting();
                            app.UseAuthentication();
                            app.UseAuthorization();
                            app.UseEndpoints(endpoints =>
                            {
                                foreach (var module in new IFeatureModule[]
                                {
                                    new GetAiProviders(), new CreateAiProvider(), new UpdateAiProvider(),
                                    new DeleteAiProvider(), new ActivateAiProvider(), new TestAiProviderConnection()
                                })
                                    module.AddRoutes(endpoints);
                            });
                        });
                })
                .Build();

            await host.StartAsync();
            return host;
        }

        private static HttpClient ClientFor(IHost host, string? userId)
        {
            var client = host.GetTestClient();
            if (userId is not null)
                client.DefaultRequestHeaders.Add(UserHeader, userId);
            return client;
        }

        private static object ValidBody(string? apiKey = SecretKey, string baseUrl = "https://8.8.8.8/v1") =>
            new { template = "openai", baseUrl, apiKey, model = "gpt-4o-mini" };

        [Theory]
        [InlineData("GET", "/api/ai-providers")]
        [InlineData("POST", "/api/ai-providers")]
        [InlineData("PUT", "/api/ai-providers/p1")]
        [InlineData("DELETE", "/api/ai-providers/p1")]
        [InlineData("POST", "/api/ai-providers/p1/activate")]
        [InlineData("POST", "/api/ai-providers/test")]
        public async Task Anonymous_IsUnauthorized(string method, string url)
        {
            using var host = await StartHostAsync();
            using var request = new HttpRequestMessage(new HttpMethod(method), url);

            var response = await ClientFor(host, null).SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Create_WithMissingFields_ReturnsAValidationErrorNamingEachField()
        {
            using var host = await StartHostAsync();

            var response = await ClientFor(host, Guid.NewGuid().ToString())
                .PostAsJsonAsync("/api/ai-providers", new { template = "openai" });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            var body = await response.Content.ReadAsStringAsync();
            Assert.Contains("BaseUrl:", body);
            Assert.Contains("ApiKey:", body);
            Assert.Contains("Model:", body);
        }

        [Fact]
        public async Task Create_ThenList_NeverReturnsTheApiKey()
        {
            using var host = await StartHostAsync();
            var client = ClientFor(host, Guid.NewGuid().ToString());

            var created = await client.PostAsJsonAsync("/api/ai-providers", ValidBody());
            var list = await client.GetAsync("/api/ai-providers");

            Assert.Equal(HttpStatusCode.Created, created.StatusCode);
            var createdBody = await created.Content.ReadAsStringAsync();
            var listBody = await list.Content.ReadAsStringAsync();
            Assert.DoesNotContain(SecretKey, createdBody);
            Assert.DoesNotContain(SecretKey, listBody);
            using var json = JsonDocument.Parse(listBody);
            Assert.Equal("****5555", json.RootElement[0].GetProperty("maskedApiKey").GetString());
        }

        [Fact]
        public async Task Create_WithAPrivateBaseUrl_IsRejectedWithItsErrorCode()
        {
            using var host = await StartHostAsync();

            var response = await ClientFor(host, Guid.NewGuid().ToString())
                .PostAsJsonAsync("/api/ai-providers", ValidBody(baseUrl: "https://10.0.0.7/v1"));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.Equal("AiProviderBaseUrlInvalid", json.RootElement.GetProperty("code").GetString());
        }

        [Fact]
        public async Task Test_WithAPrivateBaseUrl_ReportsInvalidBaseUrlWithoutCreatingAnything()
        {
            using var host = await StartHostAsync();
            var userId = Guid.NewGuid().ToString();
            var client = ClientFor(host, userId);

            var response = await client.PostAsJsonAsync("/api/ai-providers/test", ValidBody(baseUrl: "https://192.168.1.1/v1"));

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.False(json.RootElement.GetProperty("success").GetBoolean());
            Assert.Equal("InvalidBaseUrl", json.RootElement.GetProperty("failure").GetString());
            await using var db = _fixture.CreateDbContext();
            Assert.False(await db.AiProviderSettings.AnyAsync(p => p.UserId == userId));
        }

        [Fact]
        public async Task Update_ActivateAndDelete_WorkOnTheOwnProvider()
        {
            using var host = await StartHostAsync();
            var client = ClientFor(host, Guid.NewGuid().ToString());
            var created = await client.PostAsJsonAsync("/api/ai-providers", ValidBody());
            using var createdJson = JsonDocument.Parse(await created.Content.ReadAsStringAsync());
            var id = createdJson.RootElement.GetProperty("id").GetString();

            var updated = await client.PutAsJsonAsync($"/api/ai-providers/{id}", ValidBody(apiKey: null));
            var activated = await client.PostAsync($"/api/ai-providers/{id}/activate", null);
            var listAfterActivation = JsonDocument.Parse(await (await client.GetAsync("/api/ai-providers")).Content.ReadAsStringAsync());
            var deleted = await client.DeleteAsync($"/api/ai-providers/{id}");
            var listAfterDelete = JsonDocument.Parse(await (await client.GetAsync("/api/ai-providers")).Content.ReadAsStringAsync());

            Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
            Assert.Equal(HttpStatusCode.NoContent, activated.StatusCode);
            Assert.True(listAfterActivation.RootElement[0].GetProperty("isActive").GetBoolean());
            Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
            Assert.Equal(0, listAfterDelete.RootElement.GetArrayLength());
        }

        [Fact]
        public async Task Delete_OfAnotherUsersProvider_ReturnsNotFound()
        {
            using var host = await StartHostAsync();
            var created = await ClientFor(host, Guid.NewGuid().ToString()).PostAsJsonAsync("/api/ai-providers", ValidBody());
            using var createdJson = JsonDocument.Parse(await created.Content.ReadAsStringAsync());
            var id = createdJson.RootElement.GetProperty("id").GetString();

            var response = await ClientFor(host, Guid.NewGuid().ToString()).DeleteAsync($"/api/ai-providers/{id}");

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }
    }
}
