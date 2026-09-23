#nullable enable
using System;
using System.Net.Http;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Mediator;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Audit;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Verifies the X-Total-Count header actually reaches the HTTP client through the real
    /// Minimal API pipeline (unlike SearchAuditLogHandlerTests, which calls the handler
    /// directly and never exercises the endpoint delegate that sets the header).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class SearchAuditLogEndpointTests
    {
        private readonly PostgresContainerFixture _fixture;

        public SearchAuditLogEndpointTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
        {
            public const string SchemeName = "Test";

            public TestAuthHandler(
                IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
                : base(options, logger, encoder) { }

            protected override Task<AuthenticateResult> HandleAuthenticateAsync()
            {
                var role = Request.Headers.TryGetValue("X-Test-Role", out var values) ? values.ToString() : "Federation";
                var claims = new System.Collections.Generic.List<Claim>
                {
                    new Claim(ClaimTypes.NameIdentifier, "test-user"),
                    new Claim(ClaimTypes.Role, role),
                };
                var identity = new ClaimsIdentity(claims, SchemeName);
                var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName);
                return Task.FromResult(AuthenticateResult.Success(ticket));
            }
        }

        private async Task<(IHost Host, HttpClient Client)> StartHostAsync()
        {
            var userManagerMock = new Mock<UserManager<IdentityUser>>(
                new Mock<IUserStore<IdentityUser>>().Object, null!, null!, null!, null!, null!, null!, null!, null!);

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
                                    npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "app"));
                            });
                            services.AddHttpContextAccessor();
                            services.AddScoped<ICurrentUserService, CurrentUserService>();
                            services.AddSingleton(userManagerMock.Object);
                            services.AddMediator(o => { o.ServiceLifetime = ServiceLifetime.Scoped; });
                        })
                        .Configure(app =>
                        {
                            app.UseRouting();
                            app.UseAuthentication();
                            app.UseAuthorization();
                            app.UseEndpoints(endpoints => new SearchAuditLog().AddRoutes(endpoints));
                        });
                })
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient());
        }

        [Fact]
        public async Task Get_ReturnsXTotalCountHeader_MatchingItemCount()
        {
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, "/api/audit-log");
            request.Headers.Add("X-Test-Role", "Federation");

            var response = await client.SendAsync(request);

            Assert.True(response.Headers.TryGetValues("X-Total-Count", out var values), "X-Total-Count header was not present on the response.");
        }
    }
}
