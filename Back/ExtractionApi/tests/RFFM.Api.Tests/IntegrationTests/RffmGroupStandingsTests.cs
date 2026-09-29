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
using Moq;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Features.Federation.Competitions.Models;
using RFFM.Api.Features.Federation.Competitions.Services;
using RFFM.Api.Features.Federation.MatchResults.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.Fixtures.FakeRffmResultsClient;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class RffmGroupStandingsTests
    {
        private const int Season = 22;

        // 26/09/2026 14:05 en Madrid
        private static readonly DateTimeOffset Now = new(2026, 9, 26, 12, 5, 0, TimeSpan.Zero);

        private readonly PostgresContainerFixture _fixture;
        private readonly FakeRffmResultsClient _client = new();
        private readonly RecordingJobQueue _queue = new();
        private readonly KeyedLock _keyedLock = new();
        private readonly MutableTimeProvider _time = new(Now);
        private readonly Mock<ICompetitionService> _officialClassification = new();
        private readonly string _groupCode = Random.Shared.Next(10_000_000, 99_999_999).ToString();

        public RffmGroupStandingsTests(PostgresContainerFixture fixture) => _fixture = fixture;

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

        private int GroupId => int.Parse(_groupCode);

        private RffmResultsSyncService CreateService(FederationDbContext db) =>
            new(db, _client, _queue, _keyedLock, _time, Options.Create(new RffmOptions()), _officialClassification.Object,
                NullLogger<RffmResultsSyncService>.Instance);

        private async Task<T> WithServiceAsync<T>(Func<RffmResultsSyncService, Task<T>> action)
        {
            await using var db = _fixture.CreateFederationDbContext();
            return await action(CreateService(db));
        }

        private Task<Features.Federation.Competitions.Queries.GetCalendar.Responses.CalendarResponse> CalendarAsync() =>
            WithServiceAsync(s => s.GetCalendarAsync(GroupId, Season, CancellationToken.None));

        private Task<ClassificationResponse> ClassificationAsync() =>
            WithServiceAsync(s => s.GetClassificationAsync(GroupId, Season, CancellationToken.None));

        private void Round(int round, params Features.Federation.Competitions.Models.ApiRffm.MatchInfo[] matches) =>
            _client.Rounds[(_groupCode, round)] = Calendar(_groupCode, round, matches);

        private void TwoRoundsWithResults()
        {
            Round(1, Match("R1", "26/09/2026", "10:00", "1", "2", "0"));
            Round(2, Match("R2", "10/10/2026", "10:00"));
        }

        [Fact]
        public async Task El_calendario_de_un_grupo_nuevo_descarga_todas_sus_jornadas_una_sola_vez()
        {
            TwoRoundsWithResults();

            var first = await CalendarAsync();
            var second = await CalendarAsync();

            Assert.Equal([1, 2], second.MatchDays.Select(d => d.MatchDayNumber));
            Assert.Equal(["R1"], first.MatchDays[0].Matches.Select(m => m.MatchRecordCode));
            Assert.Equal([1, 2], _client.RequestedRounds);
        }

        [Fact]
        public async Task Solo_se_vuelven_a_pedir_las_jornadas_que_lo_necesitan()
        {
            Round(1, Match("R1", "26/09/2026", "10:00", "1", "2", "0"));
            Round(2, Match("R2", "10/10/2026", ""));
            await CalendarAsync();
            _time.Advance(TimeSpan.FromHours(7));

            await CalendarAsync();

            Assert.Equal([1, 2, 2], _client.RequestedRounds);
        }

        [Fact]
        public async Task Un_fallo_en_una_jornada_no_impide_devolver_las_demas()
        {
            TwoRoundsWithResults();
            _client.FailingRounds.Add(2);

            var calendar = await CalendarAsync();

            Assert.Equal("R1", Assert.Single(calendar.MatchDays.Single(d => d.MatchDayNumber == 1).Matches).MatchRecordCode);
            Assert.Empty(calendar.MatchDays.Single(d => d.MatchDayNumber == 2).Matches);
        }

        [Fact]
        public async Task El_grupo_guarda_la_temporada_y_los_puntos_de_su_competicion()
        {
            TwoRoundsWithResults();
            _client.Competition = new RffmCompetitionInfo(21, 70, 2, new RffmPointsSystem(2, 1, 0));

            await CalendarAsync();

            await using var db = _fixture.CreateFederationDbContext();
            var group = await db.RffmCompetitionGroups.SingleAsync(g => g.GroupCode == _groupCode);
            Assert.Equal((21, 70, 2), (group.SeasonId, group.MatchMinutes, group.PointsWin));
        }

        [Fact]
        public async Task La_clasificacion_se_calcula_con_los_resultados_guardados_y_se_guarda_por_jornada()
        {
            TwoRoundsWithResults();

            var classification = await ClassificationAsync();

            var leader = classification.Teams[0];
            Assert.Equal(("1598", "1", "3", "1", "G"), (leader.TeamId, leader.Position, leader.Points, leader.HomePlayed,
                Assert.Single(leader.MatchStreaks).Type));
            await using var db = _fixture.CreateFederationDbContext();
            var snapshot = await db.RffmStandingsSnapshots.SingleAsync(s => s.GroupCode == _groupCode);
            Assert.Equal((1, StandingsSource.Computed), (snapshot.Round, snapshot.Source));
        }

        [Fact]
        public async Task Un_resultado_nuevo_actualiza_la_clasificacion()
        {
            Round(1, Match("R1", "26/09/2026", "12:30"));
            Round(2, Match("R2", "10/10/2026", "10:00"));
            await ClassificationAsync();
            Round(1, Match("R1", "26/09/2026", "12:30", "1", "0", "3"));
            _time.Advance(TimeSpan.FromMinutes(11));

            var classification = await ClassificationAsync();

            Assert.Equal(("8972474", "3"), (classification.Teams[0].TeamId, classification.Teams[0].Points));
        }

        [Fact]
        public async Task Una_segunda_consulta_de_la_clasificacion_no_llama_a_la_rffm()
        {
            TwoRoundsWithResults();
            await ClassificationAsync();

            await ClassificationAsync();

            Assert.Equal(2, _client.RoundCalls);
        }

        [Fact]
        public async Task Con_jornadas_pasadas_sin_descargar_se_devuelve_la_clasificacion_oficial()
        {
            _client.Fail = true;
            var official = new ClassificationResponse { Teams = [new TeamResponse { TeamId = "OFICIAL" }] };
            _officialClassification.Setup(c => c.GetClassification(GroupId, It.IsAny<CancellationToken>())).ReturnsAsync(official);

            var classification = await ClassificationAsync();

            Assert.Equal("OFICIAL", Assert.Single(classification.Teams).TeamId);
        }

        [Fact]
        public async Task Una_jornada_con_todas_las_actas_cerradas_encola_la_conciliacion()
        {
            TwoRoundsWithResults();

            await ClassificationAsync();

            Assert.Contains(_queue.Jobs, j => j is ReconcileStandingsJob { Round: 1 } r && r.GroupCode == _groupCode);
        }

        [Fact]
        public async Task La_clasificacion_aplica_sanciones_y_colores_de_la_clasificacion_oficial()
        {
            TwoRoundsWithResults();
            await ClassificationAsync();
            await using (var db = _fixture.CreateFederationDbContext())
            {
                var group = await db.RffmCompetitionGroups.SingleAsync(g => g.GroupCode == _groupCode);
                group.UpdateOfficialStandings(RffmMatchDayMapper.SerializeStandings(
                [
                    new TeamResponse { TeamId = "8972474", Position = "1", Color = "#41FF1A", SanctionPoints = "0" },
                    new TeamResponse { TeamId = "1598", Position = "2", Color = "", SanctionPoints = "4" }
                ]), 1);
                await db.SaveChangesAsync();
                await CreateService(db).RecomputeStandingsAsync(_groupCode, CancellationToken.None);
            }

            var classification = await ClassificationAsync();

            Assert.Equal(("8972474", "#41FF1A"), (classification.Teams[0].TeamId, classification.Teams[0].Color));
            Assert.Equal(("1598", "-1", "4"), (classification.Teams[1].TeamId, classification.Teams[1].Points, classification.Teams[1].SanctionPoints));
        }
    }
}
