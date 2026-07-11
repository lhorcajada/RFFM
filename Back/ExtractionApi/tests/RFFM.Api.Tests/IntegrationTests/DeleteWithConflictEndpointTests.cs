#nullable enable
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Seasons.Commands;
using RFFM.Api.Features.Coaches.Teams.Commands;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Regression tests for the code-review bugs found in openspec change `unified-error-codes-i18n`:
    /// DeleteTeam and DeleteSeason caught their conflict DomainException but built the 409 ProblemDetails
    /// by hand without ever setting Extensions["code"], so the frontend i18n dictionary had nothing to
    /// look up. They also compared exception.Code against a duplicated, unrelated constant
    /// (TeamConstants.TeamHasPlayersCode / SeasonConstants.SeasonHasRelatedDataCode) instead of the
    /// single source of truth in RFFM.Api.Domain.ErrorCodes.
    /// </summary>
    public class DeleteWithConflictEndpointTests
    {
        private static async Task<(HttpResponseMessage Response, JsonElement Body)> InvokeAsync(
            IFeatureModule module,
            IMediator mediator,
            HttpMethod method,
            string path)
        {
            using var host = new HostBuilder()
                .ConfigureWebHost(webBuilder =>
                {
                    webBuilder
                        .UseTestServer()
                        .ConfigureServices(services =>
                        {
                            services.AddRouting();
                            services.AddSingleton(mediator);
                        })
                        .Configure(app =>
                        {
                            app.UseRouting();
                            app.UseEndpoints(endpoints => module.AddRoutes(endpoints));
                        });
                })
                .Build();

            await host.StartAsync();

            var client = host.GetTestClient();
            var request = new HttpRequestMessage(method, path);
            var response = await client.SendAsync(request);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            return (response, body);
        }

        [Fact]
        public async Task DeleteTeam_WhenTeamHasPlayers_ReturnsConflictWithTeamHasPlayersCode()
        {
            var mediatorMock = new Mock<IMediator>();
            mediatorMock
                .Setup(m => m.Send(It.IsAny<DeleteTeamCommand>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new DomainException(
                    "Equipos",
                    "No se puede eliminar el equipo porque tiene jugadores asociados.",
                    ErrorCodes.TeamHasPlayers));

            var (response, body) = await InvokeAsync(
                new DeleteTeam(), mediatorMock.Object, HttpMethod.Delete, "/api/catalog/team/team-1");

            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            Assert.True(body.TryGetProperty("code", out var code), "ProblemDetails is missing Extensions[\"code\"]");
            Assert.Equal(ErrorCodes.TeamHasPlayers, code.GetString());
        }

        [Fact]
        public async Task DeleteSeason_WhenSeasonHasRelatedData_ReturnsConflictWithSeasonHasRelatedDataCode()
        {
            var mediatorMock = new Mock<IMediator>();
            mediatorMock
                .Setup(m => m.Send(It.IsAny<DeleteSeasonCommand>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new DomainException(
                    "Temporadas",
                    "No se puede eliminar la temporada porque ya tiene datos relacionados.",
                    ErrorCodes.SeasonHasRelatedData));

            var (response, body) = await InvokeAsync(
                new DeleteSeason(), mediatorMock.Object, HttpMethod.Delete, "/api/catalog/season/season-1");

            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            Assert.True(body.TryGetProperty("code", out var code), "ProblemDetails is missing Extensions[\"code\"]");
            Assert.Equal(ErrorCodes.SeasonHasRelatedData, code.GetString());
        }
    }
}
