#nullable enable
using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Threading.Tasks;
using Mediator;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain.Entities.Federation;
using RFFM.Api.Domain.Entities.Federation.MatchResultNotifications;
using RFFM.Api.Features.Federation.MatchResultNotifications;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class MatchResultNotificationPreferenceEndpointTests
    {
        private const string Path = "/api/match-result-notifications/preference";
        private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };
        private static readonly int CurrentSeasonId = new RffmOptions().CurrentSeasonId;
        private readonly PostgresContainerFixture _fixture;

        public MatchResultNotificationPreferenceEndpointTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
        {
            public const string SchemeName = "Test";

            public TestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
                : base(options, logger, encoder)
            {
            }

            protected override Task<AuthenticateResult> HandleAuthenticateAsync()
            {
                if (!Request.Headers.TryGetValue("X-Test-User", out var user))
                    return Task.FromResult(AuthenticateResult.NoResult());

                var identity = new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, user.ToString()) }, SchemeName);
                return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
            }
        }

        private async Task<(IHost Host, HttpClient Client)> StartHostAsync()
        {
            var host = new HostBuilder()
                .ConfigureWebHost(web => web
                    .UseTestServer()
                    .ConfigureServices(services =>
                    {
                        services.AddRouting();
                        services.AddAuthentication(TestAuthHandler.SchemeName)
                            .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
                        services.AddAuthorization();
                        services.AddDbContext<FederationDbContext>(o => o.UseNpgsql(_fixture.ConnectionString,
                            npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "federation")));
                        services.AddMediator(o => { o.ServiceLifetime = ServiceLifetime.Scoped; });
                        services.AddSingleton(TimeProvider.System);
                    })
                    .Configure(app =>
                    {
                        app.UseRouting();
                        app.UseAuthentication();
                        app.UseAuthorization();
                        app.UseEndpoints(endpoints =>
                        {
                            new GetMatchResultNotificationPreference().AddRoutes(endpoints);
                            new UpdateMatchResultNotificationPreference().AddRoutes(endpoints);
                        });
                    }))
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient());
        }

        private static string NewUserId() => $"user-{Guid.NewGuid():N}";

        private static HttpRequestMessage Get(string? user) =>
            new(HttpMethod.Get, Path) { Headers = { { "X-Test-User", user ?? string.Empty } } };

        private static HttpRequestMessage Put(string? user, bool enabled) =>
            new(HttpMethod.Put, Path)
            {
                Content = JsonContent.Create(new { enabled }),
                Headers = { { "X-Test-User", user ?? string.Empty } }
            };

        private async Task SeedSettingAsync(string userId, string teamName, bool isPrimary, int? seasonId)
        {
            await using var db = _fixture.CreateFederationDbContext();
            db.FederationSettings.Add(new FederationSetting(userId, "10", "Liga", "20", "Grupo 1", "555", teamName,
                isPrimary, seasonId));
            await db.SaveChangesAsync();
        }

        private async Task<GetMatchResultNotificationPreference.MatchResultNotificationPreferenceResponse> ReadAsync(
            HttpClient client, string userId)
        {
            var response = await client.SendAsync(Get(userId));
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return (await response.Content.ReadFromJsonAsync<GetMatchResultNotificationPreference.MatchResultNotificationPreferenceResponse>(JsonOptions))!;
        }

        [Fact]
        public async Task Get_sin_autenticar_devuelve_401()
        {
            var (host, client) = await StartHostAsync();
            using var _host = host;

            var response = await client.SendAsync(new HttpRequestMessage(HttpMethod.Get, Path));

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Put_sin_autenticar_devuelve_401()
        {
            var (host, client) = await StartHostAsync();
            using var _host = host;
            var request = new HttpRequestMessage(HttpMethod.Put, Path) { Content = JsonContent.Create(new { enabled = false }) };

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Get_por_defecto_esta_activado_y_devuelve_el_equipo_principal_de_la_temporada_actual()
        {
            var (host, client) = await StartHostAsync();
            using var _host = host;
            var userId = NewUserId();
            await SeedSettingAsync(userId, "CD Secundario", isPrimary: false, CurrentSeasonId);
            await SeedSettingAsync(userId, "CD Principal A", isPrimary: true, CurrentSeasonId);

            var body = await ReadAsync(client, userId);

            Assert.True(body.Enabled);
            Assert.Equal("CD Principal A", body.TeamName);
        }

        [Fact]
        public async Task Get_trata_la_temporada_vacia_como_la_actual()
        {
            var (host, client) = await StartHostAsync();
            using var _host = host;
            var userId = NewUserId();
            await SeedSettingAsync(userId, "CD Sin Temporada", isPrimary: true, seasonId: null);

            var body = await ReadAsync(client, userId);

            Assert.Equal("CD Sin Temporada", body.TeamName);
        }

        [Fact]
        public async Task Get_sin_equipo_principal_de_la_temporada_actual_devuelve_teamName_nulo()
        {
            var (host, client) = await StartHostAsync();
            using var _host = host;
            var userId = NewUserId();
            await SeedSettingAsync(userId, "CD Temporada Pasada", isPrimary: true, CurrentSeasonId - 1);

            var body = await ReadAsync(client, userId);

            Assert.True(body.Enabled);
            Assert.Null(body.TeamName);
        }

        [Fact]
        public async Task Put_false_desactiva_las_notificaciones()
        {
            var (host, client) = await StartHostAsync();
            using var _host = host;
            var userId = NewUserId();

            var response = await client.SendAsync(Put(userId, enabled: false));

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
            Assert.False((await ReadAsync(client, userId)).Enabled);
        }

        [Fact]
        public async Task Put_false_dos_veces_es_idempotente()
        {
            var (host, client) = await StartHostAsync();
            using var _host = host;
            var userId = NewUserId();

            await client.SendAsync(Put(userId, enabled: false));
            var response = await client.SendAsync(Put(userId, enabled: false));

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
            await using var db = _fixture.CreateFederationDbContext();
            Assert.Equal(1, await db.MatchResultNotificationOptOuts.CountAsync(o => o.UserId == userId));
        }

        [Fact]
        public async Task Put_true_vuelve_a_activar_las_notificaciones()
        {
            var (host, client) = await StartHostAsync();
            using var _host = host;
            var userId = NewUserId();
            await client.SendAsync(Put(userId, enabled: false));

            var response = await client.SendAsync(Put(userId, enabled: true));

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
            Assert.True((await ReadAsync(client, userId)).Enabled);
        }

        [Fact]
        public async Task Put_de_un_usuario_no_afecta_a_otro()
        {
            var (host, client) = await StartHostAsync();
            using var _host = host;
            var userId = NewUserId();
            var otherUserId = NewUserId();

            await client.SendAsync(Put(userId, enabled: false));

            Assert.True((await ReadAsync(client, otherUserId)).Enabled);
        }

        [Fact]
        public void Validator_rechaza_el_comando_sin_enabled()
        {
            var validator = new UpdateMatchResultNotificationPreference.Validator();

            var result = validator.Validate(new UpdateMatchResultNotificationPreference.UpdateMatchResultNotificationPreferenceCommand("user-1", null));

            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validator_acepta_el_comando_con_enabled()
        {
            var validator = new UpdateMatchResultNotificationPreference.Validator();

            var result = validator.Validate(new UpdateMatchResultNotificationPreference.UpdateMatchResultNotificationPreferenceCommand("user-1", false));

            Assert.True(result.IsValid);
        }
    }
}
