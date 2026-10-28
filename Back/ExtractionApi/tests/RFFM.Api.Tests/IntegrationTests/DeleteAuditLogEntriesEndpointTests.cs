#nullable enable
using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading.Tasks;
using FluentValidation;
using Hellang.Middleware.ProblemDetails;
using Mediator;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.DependencyInjection;
using RFFM.Api.Domain.Entities.Audit;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Audit;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// DELETE /api/audit-log con el pipeline real (validación y autorización por rol).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class DeleteAuditLogEntriesEndpointTests
    {
        private readonly PostgresContainerFixture _fixture;

        public DeleteAuditLogEntriesEndpointTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
        {
            public const string SchemeName = "Test";

            public TestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
                : base(options, logger, encoder)
            {
            }

            protected override Task<AuthenticateResult> HandleAuthenticateAsync()
            {
                if (!Request.Headers.TryGetValue("X-Test-Role", out var values))
                    return Task.FromResult(AuthenticateResult.NoResult());

                var role = values.ToString();
                var claims = new List<Claim> { new(ClaimTypes.Name, "test-user"), new(ClaimTypes.NameIdentifier, "test-user") };
                if (!string.IsNullOrEmpty(role))
                    claims.Add(new Claim(ClaimTypes.Role, role));

                var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, SchemeName));
                return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, SchemeName)));
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
                            services.AddControllers();
                            services.AddAuthentication(TestAuthHandler.SchemeName)
                                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
                            services.AddAuthorization();
                            services.AddDbContext<AppDbContext>(options =>
                                options.UseNpgsql(_fixture.ConnectionString, npgsql =>
                                    npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "app")));
                            services.AddHttpContextAccessor();
                            services.AddScoped<ICurrentUserService, CurrentUserService>();
                            services.AddSingleton(userManagerMock.Object);
                            services.AddCustomProblemDetails()
                                .AddMediator(o => { o.ServiceLifetime = ServiceLifetime.Scoped; });
                            services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
                            services.AddScoped<IValidator<DeleteAuditLogEntries.DeleteAuditLogEntriesCommand>, DeleteAuditLogEntries.Validator>();
                        })
                        .Configure(app =>
                        {
                            app.UseProblemDetails();
                            app.UseRouting();
                            app.UseAuthentication();
                            app.UseAuthorization();
                            app.UseEndpoints(endpoints =>
                            {
                                new DeleteAuditLogEntries().AddRoutes(endpoints);
                                new SearchAuditLog().AddRoutes(endpoints);
                            });
                        });
                })
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient());
        }

        private async Task<string> SeedLogAsync()
        {
            await using var db = _fixture.CreateDbContext();
            var log = UserActivityLog.Create(
                userId: "user-" + Guid.NewGuid().ToString("N").Substring(0, 6),
                roleName: "Coach",
                clubId: null,
                teamId: null,
                ipAddress: "192.168.1.1",
                eventType: AuditEventType.PageAccess,
                actionOrPage: "Roster",
                result: "Success",
                reason: null,
                subjectId: null);
            db.UserActivityLogs.Add(log);
            await db.SaveChangesAsync();
            return log.Id;
        }

        private static HttpRequestMessage DeleteRequest(string role, params string[] ids)
        {
            var request = new HttpRequestMessage(HttpMethod.Delete, "/api/audit-log")
            {
                Content = JsonContent.Create(new DeleteAuditLogEntries.DeleteAuditLogEntriesRequest(ids))
            };
            request.Headers.Add("X-Test-Role", role);
            return request;
        }

        [Theory]
        [InlineData("Coach")]
        [InlineData("ClubDirector")]
        public async Task Delete_ForbiddenForCoachAndClubDirector(string role)
        {
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var response = await client.SendAsync(DeleteRequest(role, await SeedLogAsync()));

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task Delete_Anonymous_ReturnsUnauthorized()
        {
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Delete, "/api/audit-log")
            {
                Content = JsonContent.Create(new DeleteAuditLogEntries.DeleteAuditLogEntriesRequest(new[] { "evt-1" }))
            };

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Theory]
        [InlineData("Federation")]
        [InlineData("Administrator")]
        public async Task Delete_AllowedForFederationAndAdministrator(string role)
        {
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var response = await client.SendAsync(DeleteRequest(role, await SeedLogAsync()));

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        [Fact]
        public async Task Delete_InvalidList_ReturnsBadRequest()
        {
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var response = await client.SendAsync(DeleteRequest("Federation"));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Delete_RemovedEvents_NoLongerReturnedByGetAuditLog()
        {
            var (host, client) = await StartHostAsync();
            using var _ = host;
            var logId = await SeedLogAsync();

            var deleteResponse = await client.SendAsync(DeleteRequest("Federation", logId));
            Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);

            var getRequest = new HttpRequestMessage(HttpMethod.Get, "/api/audit-log?pageSize=100");
            getRequest.Headers.Add("X-Test-Role", "Federation");
            var getResponse = await client.SendAsync(getRequest);
            var items = await getResponse.Content.ReadFromJsonAsync<SearchAuditLog.UserActivityLogResponse[]>();

            Assert.DoesNotContain(items!, i => i.Id == logId);
        }
    }
}
