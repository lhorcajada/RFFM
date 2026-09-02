#nullable enable
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Clubs.Models;
using RFFM.Api.Features.Federation.Clubs.Queries;
using RFFM.Api.Features.Federation.Clubs.Services;
using RFFM.Api.Features.Federation.Competitions.Services;
using RFFM.Api.Infrastructure.Options;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// "/clubs/search" and "/clubs/{clubCode}/teams" never sent a "temporada" to
    /// IClubDirectoryService (nor to ICompetitionService for the latter), so both endpoints
    /// always resolved against whatever season rffm.es defaulted to. This regression suite
    /// asserts both endpoints now resolve "temporada" from the configured
    /// RffmOptions.CurrentSeasonId when omitted, honor an explicit query value when provided,
    /// and isolate the memory cache per resolved season.
    /// </summary>
    public class ClubsSeasonTests
    {
        private class AlwaysAuthenticatedHandler : AuthenticationHandler<AuthenticationSchemeOptions>
        {
            public const string SchemeName = "Test";

            public AlwaysAuthenticatedHandler(
                IOptionsMonitor<AuthenticationSchemeOptions> options,
                ILoggerFactory logger,
                UrlEncoder encoder)
                : base(options, logger, encoder)
            {
            }

            protected override Task<AuthenticateResult> HandleAuthenticateAsync()
            {
                var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, "test-user") };
                var identity = new ClaimsIdentity(claims, SchemeName);
                var principal = new ClaimsPrincipal(identity);
                var ticket = new AuthenticationTicket(principal, SchemeName);
                return Task.FromResult(AuthenticateResult.Success(ticket));
            }
        }

        private async Task<(IHost Host, HttpClient Client, Mock<IClubDirectoryService> ClubDirectoryMock, Mock<ICompetitionService> CompetitionMock)> StartHostAsync(int currentSeasonId)
        {
            var clubDirectoryMock = new Mock<IClubDirectoryService>();
            clubDirectoryMock
                .Setup(s => s.SearchAsync(It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<int?>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Array.Empty<ClubDirectoryItem>());
            clubDirectoryMock
                .Setup(s => s.GetClubTeamsAsync(It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Array.Empty<ClubTeamDirectoryItem>());

            var competitionMock = new Mock<ICompetitionService>();
            competitionMock
                .Setup(s => s.GetCompetitionsAsync(It.IsAny<int?>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Array.Empty<ResponseCompetition>());

            var host = new HostBuilder()
                .ConfigureWebHost(webBuilder =>
                {
                    webBuilder
                        .UseTestServer()
                        .ConfigureServices(services =>
                        {
                            services.AddRouting();
                            services.AddAuthentication(AlwaysAuthenticatedHandler.SchemeName)
                                .AddScheme<AuthenticationSchemeOptions, AlwaysAuthenticatedHandler>(AlwaysAuthenticatedHandler.SchemeName, _ => { });
                            services.AddAuthorization();
                            services.AddMemoryCache();
                            services.AddSingleton(clubDirectoryMock.Object);
                            services.AddSingleton(competitionMock.Object);
                            services.Configure<RffmOptions>(o => o.CurrentSeasonId = currentSeasonId);
                        })
                        .Configure(app =>
                        {
                            app.UseRouting();
                            app.UseAuthentication();
                            app.UseAuthorization();
                            app.UseEndpoints(endpoints =>
                            {
                                new FederationSearchClubs().AddRoutes(endpoints);
                                new FederationGetClubTeams().AddRoutes(endpoints);
                            });
                        });
                })
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient(), clubDirectoryMock, competitionMock);
        }

        [Fact]
        public async Task SearchClubs_WithoutExplicitTemporada_UsesConfiguredCurrentSeasonId()
        {
            var (host, client, clubDirectoryMock, _) = await StartHostAsync(currentSeasonId: 22);
            using var _h = host;

            var response = await client.GetAsync("/clubs/search?search=foo");
            response.EnsureSuccessStatusCode();

            clubDirectoryMock.Verify(s => s.SearchAsync("foo", "", 22, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task SearchClubs_WithExplicitTemporada_OverridesConfiguredCurrentSeasonId()
        {
            var (host, client, clubDirectoryMock, _) = await StartHostAsync(currentSeasonId: 22);
            using var _h = host;

            var response = await client.GetAsync("/clubs/search?search=foo&temporada=20");
            response.EnsureSuccessStatusCode();

            clubDirectoryMock.Verify(s => s.SearchAsync("foo", "", 20, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task GetClubTeams_WithoutExplicitTemporada_UsesConfiguredCurrentSeasonId()
        {
            var (host, client, clubDirectoryMock, competitionMock) = await StartHostAsync(currentSeasonId: 22);
            using var _h = host;

            var response = await client.GetAsync("/clubs/CLUB1/teams");
            response.EnsureSuccessStatusCode();

            clubDirectoryMock.Verify(s => s.GetClubTeamsAsync("CLUB1", 22, It.IsAny<CancellationToken>()), Times.Once);
            competitionMock.Verify(s => s.GetCompetitionsAsync(22, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task GetClubTeams_DifferentSeasons_DoNotShareCachedResults()
        {
            var (host, client, clubDirectoryMock, _) = await StartHostAsync(currentSeasonId: 22);
            using var _h = host;

            await client.GetAsync("/clubs/CLUB1/teams?temporada=22");
            await client.GetAsync("/clubs/CLUB1/teams?temporada=21");

            clubDirectoryMock.Verify(s => s.GetClubTeamsAsync("CLUB1", 22, It.IsAny<CancellationToken>()), Times.Once);
            clubDirectoryMock.Verify(s => s.GetClubTeamsAsync("CLUB1", 21, It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
