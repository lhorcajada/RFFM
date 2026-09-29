#nullable enable
using System;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Features.Federation.Teams.Services;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class ActaServiceStoreTests
    {
        private static readonly DateTime Now = new(2026, 9, 26, 18, 0, 0, DateTimeKind.Utc);

        private readonly PostgresContainerFixture _fixture;
        private readonly string _recordCode = $"T{Guid.NewGuid():N}"[..20];
        private int _httpCalls;
        private string _html = string.Empty;

        public ActaServiceStoreTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private sealed class StubHandler(Func<string> html, Action onCall) : HttpMessageHandler
        {
            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                onCall();
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(html()) });
            }
        }

        private ActaService CreateService(Infrastructure.Persistence.FederationDbContext db)
        {
            var factory = new Mock<IHttpClientFactory>();
            factory.Setup(f => f.CreateClient(It.IsAny<string>()))
                .Returns(() => new HttpClient(new StubHandler(() => _html, () => _httpCalls++)));
            return new ActaService(factory.Object, db, new MutableTimeProvider(Now));
        }

        private static string ActaHtml(string recordCode, string recordClosed) =>
            "<html><script id=\"__NEXT_DATA__\" type=\"application/json\">" +
            JsonSerializer.Serialize(new { props = new { pageProps = new { game = new MatchRffm
            {
                MatchRecordCode = recordCode, RecordClosed = recordClosed, LocalTeam = "RFFM", LocalGoals = "3"
            } } } }) +
            "</script></html>";

        private async Task<MatchRffm?> GetAsync()
        {
            await using var db = _fixture.CreateFederationDbContext();
            return await CreateService(db).GetMatchFromActaAsync(_recordCode, 22, 26738047, 26738048);
        }

        [Fact]
        public async Task Un_acta_guardada_se_devuelve_sin_llamar_a_la_rffm()
        {
            await using (var db = _fixture.CreateFederationDbContext())
            {
                var stored = new MatchRffm { MatchRecordCode = _recordCode, LocalTeam = "GUARDADA", RecordClosed = "1" };
                db.RffmMatchRecords.Add(RffmMatchRecord.Create(_recordCode, "26738048", JsonSerializer.Serialize(stored), Now));
                await db.SaveChangesAsync();
            }

            var acta = await GetAsync();

            Assert.Equal("GUARDADA", acta!.LocalTeam);
            Assert.Equal(0, _httpCalls);
        }

        [Fact]
        public async Task Un_acta_cerrada_descargada_se_guarda()
        {
            _html = ActaHtml(_recordCode, "1");

            var acta = await GetAsync();

            Assert.Equal("RFFM", acta!.LocalTeam);
            await using var db = _fixture.CreateFederationDbContext();
            var stored = await db.RffmMatchRecords.SingleAsync(r => r.RecordCode == _recordCode);
            Assert.Equal("26738048", stored.GroupCode);
        }

        [Fact]
        public async Task Un_acta_abierta_no_se_guarda()
        {
            _html = ActaHtml(_recordCode, "0");

            await GetAsync();

            await using var db = _fixture.CreateFederationDbContext();
            Assert.False(await db.RffmMatchRecords.AnyAsync(r => r.RecordCode == _recordCode));
        }
    }
}
