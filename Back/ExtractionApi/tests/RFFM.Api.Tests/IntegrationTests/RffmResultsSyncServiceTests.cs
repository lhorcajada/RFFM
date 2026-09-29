#nullable enable
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using RFFM.Api.Features.Federation.MatchResults.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.Fixtures.FakeRffmResultsClient;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class RffmResultsSyncServiceTests
    {
        private const int Season = 22;

        // 26/09/2026 14:05 en Madrid
        private static readonly DateTimeOffset Now = new(2026, 9, 26, 12, 5, 0, TimeSpan.Zero);

        private readonly PostgresContainerFixture _fixture;
        private readonly FakeRffmResultsClient _client = new();
        private readonly RecordingJobQueue _queue = new();
        private readonly KeyedLock _keyedLock = new();
        private readonly MutableTimeProvider _time = new(Now);
        private readonly string _groupCode = Random.Shared.Next(10_000_000, 99_999_999).ToString();

        public RffmResultsSyncServiceTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private sealed class RecordingJobQueue : IRffmResultsJobQueue
        {
            public ConcurrentQueue<RffmResultsJob> Jobs { get; } = new();

            public ValueTask EnqueueAsync(RffmResultsJob job, CancellationToken cancellationToken = default)
            {
                Jobs.Enqueue(job);
                return ValueTask.CompletedTask;
            }

            public IAsyncEnumerable<RffmResultsJob> DequeueAllAsync(CancellationToken cancellationToken) =>
                throw new NotSupportedException();
        }

        private RffmResultsSyncService CreateService(FederationDbContext db) =>
            new(db, _client, _queue, _keyedLock, _time, Options.Create(new RffmOptions()),
                NullLogger<RffmResultsSyncService>.Instance);

        private async Task<Features.Federation.Competitions.Queries.GetCalendarMatchDay.Responses.CalendarMatchDayWithRoundsResponse> GetAsync(int round = 1)
        {
            await using var db = _fixture.CreateFederationDbContext();
            return await CreateService(db).GetMatchDayAsync(int.Parse(_groupCode), round, Season, CancellationToken.None);
        }

        private void RffmRound1(params Features.Federation.Competitions.Models.ApiRffm.MatchInfo[] matches) =>
            _client.Rounds[(_groupCode, 1)] = Calendar(_groupCode, 1, matches);

        [Fact]
        public async Task La_primera_consulta_descarga_la_jornada_y_guarda_grupo_jornadas_y_partidos()
        {
            RffmRound1(Match("A1", "26/09/2026", "10:00", "1", "1", "0"), Match("A2", "10/10/2026", ""));

            var response = await GetAsync();

            Assert.Equal(["A1", "A2"], response.MatchDay.Matches.Select(m => m.MatchRecordCode));
            Assert.Equal([1, 2], response.Rounds.Select(r => r.MatchDayNumber));
            Assert.Equal("SUPERLIGA CADETE", response.CompetitionName);
            await using var db = _fixture.CreateFederationDbContext();
            var group = await db.RffmCompetitionGroups.SingleAsync(g => g.GroupCode == _groupCode);
            Assert.Equal(80, group.MatchMinutes);
            Assert.Equal(2, await db.RffmRounds.CountAsync(r => r.GroupCode == _groupCode));
            Assert.Equal(1, _client.RoundCalls);
            Assert.Equal(1, _client.CompetitionCalls);
        }

        [Fact]
        public async Task Una_segunda_consulta_con_todas_las_actas_cerradas_no_llama_a_la_rffm()
        {
            RffmRound1(Match("A1", "26/09/2026", "10:00", "1", "1", "0"));
            await GetAsync();
            _time.Advance(TimeSpan.FromDays(2));

            var response = await GetAsync();

            Assert.Single(response.MatchDay.Matches);
            Assert.Equal(1, _client.RoundCalls);
        }

        [Fact]
        public async Task Un_partido_sin_hora_no_se_refresca_antes_de_6_horas()
        {
            RffmRound1(Match("A1", "10/10/2026", ""));
            await GetAsync();
            _time.Advance(TimeSpan.FromHours(1));

            await GetAsync();

            Assert.Equal(1, _client.RoundCalls);
        }

        [Fact]
        public async Task Un_partido_sin_hora_se_refresca_pasadas_6_horas_y_guarda_la_hora()
        {
            RffmRound1(Match("A1", "10/10/2026", ""));
            await GetAsync();
            RffmRound1(Match("A1", "10/10/2026", "18:00"));
            _time.Advance(TimeSpan.FromHours(7));

            var response = await GetAsync();

            Assert.Equal(2, _client.RoundCalls);
            Assert.Equal("18:00", Assert.Single(response.MatchDay.Matches).Time);
        }

        [Fact]
        public async Task Un_partido_que_ha_podido_terminar_se_refresca_y_encola_su_acta_y_la_clasificacion()
        {
            RffmRound1(Match("A1", "26/09/2026", "12:30"));
            await GetAsync();
            RffmRound1(Match("A1", "26/09/2026", "12:30", "1", "2", "1"));
            _time.Advance(TimeSpan.FromMinutes(11));

            var response = await GetAsync();

            var match = Assert.Single(response.MatchDay.Matches);
            Assert.Equal("2", match.LocalGoals);
            Assert.Equal("1", match.RecordClosed);
            Assert.Contains(_queue.Jobs, j => j is FetchMatchRecordJob { RecordCode: "A1", SeasonId: Season, CompetitionCode: "26738047" });
            Assert.Contains(_queue.Jobs, j => j is RefreshStandingsJob { Round: 1 } s && s.GroupCode == _groupCode);
        }

        [Fact]
        public async Task Si_la_rffm_falla_se_devuelven_los_datos_guardados()
        {
            RffmRound1(Match("A1", "10/10/2026", ""));
            await GetAsync();
            _client.Fail = true;
            _time.Advance(TimeSpan.FromHours(7));

            var response = await GetAsync();

            Assert.Equal("A1", Assert.Single(response.MatchDay.Matches).MatchRecordCode);
        }

        [Fact]
        public async Task Si_la_rffm_falla_y_no_hay_datos_se_devuelve_la_jornada_vacia()
        {
            _client.Fail = true;

            var response = await GetAsync();

            Assert.Empty(response.MatchDay.Matches);
            Assert.Equal(1, response.Round);
            Assert.Equal(int.Parse(_groupCode), response.GroupId);
        }

        [Fact]
        public async Task Dos_consultas_simultaneas_hacen_una_sola_peticion_a_la_rffm()
        {
            RffmRound1(Match("A1", "10/10/2026", ""));
            _client.Delay = TimeSpan.FromMilliseconds(300);

            var responses = await Task.WhenAll(GetAsync(), GetAsync());

            Assert.Equal(1, _client.RoundCalls);
            Assert.All(responses, r => Assert.Single(r.MatchDay.Matches));
        }

        [Fact]
        public async Task Una_jornada_nueva_de_un_grupo_guardado_se_descarga_sin_volver_a_pedir_la_competicion()
        {
            RffmRound1(Match("A1", "26/09/2026", "10:00", "1", "1", "0"));
            _client.Rounds[(_groupCode, 2)] = Calendar(_groupCode, 2, Match("B1", "10/10/2026", "11:00"));
            await GetAsync();

            var response = await GetAsync(round: 2);

            Assert.Equal("B1", Assert.Single(response.MatchDay.Matches).MatchRecordCode);
            Assert.Equal(2, _client.RoundCalls);
            Assert.Equal(1, _client.CompetitionCalls);
        }

        [Fact]
        public async Task Un_grupo_nuevo_encola_la_descarga_de_la_clasificacion()
        {
            RffmRound1(Match("A1", "10/10/2026", ""));

            await GetAsync();

            Assert.Contains(_queue.Jobs, j => j is RefreshStandingsJob s && s.GroupCode == _groupCode);
        }
    }
}
