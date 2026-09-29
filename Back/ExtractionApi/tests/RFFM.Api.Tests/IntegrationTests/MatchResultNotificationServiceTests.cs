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
using RFFM.Api.Domain.Entities.Federation;
using RFFM.Api.Domain.Entities.Federation.MatchResultNotifications;
using RFFM.Api.Features.Coaches.Notifications.Services;
using RFFM.Api.Features.Federation.Competitions.Models;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendar.Responses;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendarMatchDay.Responses;
using RFFM.Api.Features.Federation.MatchResultNotifications.Services;
using RFFM.Api.Features.Federation.MatchResults.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.Fixtures.FakeRffmResultsClient;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class MatchResultNotificationServiceTests
    {
        private const int Season = 22;
        private const string LocalTeam = "1598";
        private const string VisitorTeam = "8972474";

        // 26/09/2026 14:05 en Madrid
        private static readonly DateTimeOffset Now = new(2026, 9, 26, 12, 5, 0, TimeSpan.Zero);

        private readonly PostgresContainerFixture _fixture;
        private readonly FakeRffmResultsClient _client = new();
        private readonly KeyedLock _keyedLock = new();
        private readonly MutableTimeProvider _time = new(Now);
        private readonly RecordingDispatcher _dispatcher = new();
        private readonly string _groupCode = Random.Shared.Next(10_000_000, 99_999_999).ToString();
        private readonly List<string> _users = new();

        public MatchResultNotificationServiceTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private sealed class RecordingDispatcher : IWebPushNotificationDispatcher
        {
            public ConcurrentQueue<(IReadOnlyCollection<string> UserIds, MatchResultMessage Message)> MatchResults { get; } = new();

            public Task DispatchMatchResultAsync(IReadOnlyCollection<string> userIds, MatchResultMessage message, CancellationToken ct = default)
            {
                MatchResults.Enqueue((userIds.ToList(), message));
                return Task.CompletedTask;
            }

            public Task DispatchConvocationCreatedAsync(string teamPlayerId, string eventId, CancellationToken ct = default) => Task.CompletedTask;
            public Task DispatchConvocationReminderAsync(string teamPlayerId, string eventId, CancellationToken ct = default) => Task.CompletedTask;
            public Task DispatchConvocationStatusChangedAsync(string convocationId, CancellationToken ct = default) => Task.CompletedTask;
            public Task DispatchSanctionChangedAsync(string sanctionId, CancellationToken ct = default) => Task.CompletedTask;
            public Task DispatchNewsPublishedAsync(string newsId, CancellationToken ct = default) => Task.CompletedTask;
            public Task DispatchInjuryChangedAsync(string injuryId, CancellationToken ct = default) => Task.CompletedTask;
            public Task DispatchNotificationsActivatedAsync(string userId, CancellationToken ct = default) => Task.CompletedTask;
        }

        private sealed class NoOpJobQueue : IRffmResultsJobQueue
        {
            public ValueTask EnqueueAsync(RffmResultsJob job, CancellationToken cancellationToken = default) => ValueTask.CompletedTask;

            public IAsyncEnumerable<RffmResultsJob> DequeueAllAsync(CancellationToken cancellationToken) =>
                throw new NotSupportedException();
        }

        /// <summary>Simula un fallo inesperado solo en un grupo.</summary>
        private sealed class FailingGroupSyncService(IRffmResultsSyncService inner, int failingGroupId) : IRffmResultsSyncService
        {
            private void ThrowIfFailing(int groupId)
            {
                if (groupId == failingGroupId) throw new InvalidOperationException("boom");
            }

            public Task<CalendarMatchDayWithRoundsResponse> GetMatchDayAsync(int groupId, int round, int seasonId, CancellationToken cancellationToken)
            {
                ThrowIfFailing(groupId);
                return inner.GetMatchDayAsync(groupId, round, seasonId, cancellationToken);
            }

            public Task<CalendarResponse> GetCalendarAsync(int groupId, int seasonId, CancellationToken cancellationToken)
            {
                ThrowIfFailing(groupId);
                return inner.GetCalendarAsync(groupId, seasonId, cancellationToken);
            }

            public Task<ClassificationResponse> GetClassificationAsync(int groupId, int seasonId, CancellationToken cancellationToken) =>
                inner.GetClassificationAsync(groupId, seasonId, cancellationToken);

            public Task RecomputeStandingsAsync(string groupCode, CancellationToken cancellationToken) =>
                inner.RecomputeStandingsAsync(groupCode, cancellationToken);

            public Task ReconcileStandingsAsync(string groupCode, int round, IReadOnlyList<TeamResponse> official, CancellationToken cancellationToken) =>
                inner.ReconcileStandingsAsync(groupCode, round, official, cancellationToken);
        }

        private RffmResultsSyncService CreateSyncService(FederationDbContext db) =>
            new(db, _client, new NoOpJobQueue(), _keyedLock, _time, Options.Create(new RffmOptions()),
                new Moq.Mock<Features.Federation.Competitions.Services.ICompetitionService>().Object,
                NullLogger<RffmResultsSyncService>.Instance);

        private async Task RunAsync(Func<IRffmResultsSyncService, IRffmResultsSyncService>? decorate = null)
        {
            await using var db = _fixture.CreateFederationDbContext();
            var syncService = CreateSyncService(db);
            var service = new MatchResultNotificationService(db, decorate?.Invoke(syncService) ?? syncService, _dispatcher, _time,
                Options.Create(new RffmOptions()), NullLogger<MatchResultNotificationService>.Instance);
            await service.RunAsync(CancellationToken.None);
        }

        private void RffmRound1(string groupCode, params Features.Federation.Competitions.Models.ApiRffm.MatchInfo[] matches) =>
            _client.Rounds[(groupCode, 1)] = Calendar(groupCode, 1, matches);

        private void RffmRound1(params Features.Federation.Competitions.Models.ApiRffm.MatchInfo[] matches) =>
            RffmRound1(_groupCode, matches);

        private async Task<string> FollowAsync(string teamCode, string? groupCode = null, bool isPrimary = true, int? seasonId = Season)
        {
            var userId = $"user-{Guid.NewGuid():N}";
            await using var db = _fixture.CreateFederationDbContext();
            db.FederationSettings.Add(new FederationSetting(userId, "26738047", "SUPERLIGA CADETE", groupCode ?? _groupCode,
                "Grupo Unico", teamCode, "Equipo", isPrimary, seasonId));
            await db.SaveChangesAsync();
            _users.Add(userId);
            return userId;
        }

        /// <summary>Solo los envíos a usuarios de este test: la BD es compartida y el servicio recorre todas las combinaciones.</summary>
        private IReadOnlyList<(IReadOnlyCollection<string> UserIds, MatchResultMessage Message)> Dispatched =>
            _dispatcher.MatchResults.Where(d => d.UserIds.Any(_users.Contains)).ToList();

        [Fact]
        public async Task Avisa_del_resultado_del_partido_del_equipo_principal()
        {
            RffmRound1(Match("A1", "26/09/2026", "10:00", "1", "2", "1"));
            var userId = await FollowAsync(LocalTeam);

            await RunAsync();

            var (userIds, message) = Assert.Single(Dispatched);
            Assert.Equal(new[] { userId }, userIds);
            Assert.Equal(new MatchResultMessage(1, "A.D. UNION ADARVE 'A'", "2", "A.D. TORREJON C.F. 'A'", "1", IsLocal: true), message);
            await using var db = _fixture.CreateFederationDbContext();
            Assert.True(await db.MatchResultNotificationLogs.AnyAsync(l => l.UserId == userId && l.RecordCode == "A1"));
        }

        [Fact]
        public async Task Avisa_al_equipo_visitante_desde_su_punto_de_vista()
        {
            RffmRound1(Match("A1", "26/09/2026", "10:00", "1", "2", "1"));
            await FollowAsync(VisitorTeam);

            await RunAsync();

            Assert.False(Assert.Single(Dispatched).Message.IsLocal);
        }

        [Fact]
        public async Task Solo_avisa_una_vez_de_cada_partido()
        {
            RffmRound1(Match("A1", "26/09/2026", "10:00", "1", "2", "1"));
            await FollowAsync(LocalTeam);

            await RunAsync();
            _time.Advance(TimeSpan.FromMinutes(15));
            await RunAsync();

            Assert.Single(Dispatched);
        }

        [Fact]
        public async Task Los_usuarios_del_mismo_equipo_reciben_un_unico_envio_agrupado()
        {
            RffmRound1(Match("A1", "26/09/2026", "10:00", "1", "2", "1"));
            var first = await FollowAsync(LocalTeam);
            var second = await FollowAsync(LocalTeam);

            await RunAsync();

            var (userIds, _) = Assert.Single(Dispatched);
            Assert.Equal(new[] { first, second }.OrderBy(id => id), userIds.OrderBy(id => id));
        }

        [Fact]
        public async Task No_avisa_de_partidos_de_otros_equipos_del_grupo()
        {
            RffmRound1(Match("A1", "26/09/2026", "10:00", "1", "2", "1"));
            await FollowAsync("9999");

            await RunAsync();

            Assert.Empty(Dispatched);
        }

        [Fact]
        public async Task No_avisa_de_combinaciones_que_no_son_principales()
        {
            RffmRound1(Match("A1", "26/09/2026", "10:00", "1", "2", "1"));
            await FollowAsync(LocalTeam, isPrimary: false);

            await RunAsync();

            Assert.Empty(Dispatched);
        }

        [Fact]
        public async Task No_avisa_de_combinaciones_de_otra_temporada()
        {
            RffmRound1(Match("A1", "26/09/2026", "10:00", "1", "2", "1"));
            await FollowAsync(LocalTeam, seasonId: Season - 1);

            await RunAsync();

            Assert.Empty(Dispatched);
        }

        [Fact]
        public async Task No_avisa_a_usuarios_que_se_han_dado_de_baja()
        {
            RffmRound1(Match("A1", "26/09/2026", "10:00", "1", "2", "1"));
            var userId = await FollowAsync(LocalTeam);
            await using (var db = _fixture.CreateFederationDbContext())
            {
                db.MatchResultNotificationOptOuts.Add(MatchResultNotificationOptOut.Create(userId, Now.UtcDateTime));
                await db.SaveChangesAsync();
            }

            await RunAsync();

            Assert.Empty(Dispatched);
        }

        [Fact]
        public async Task Sin_marcador_no_avisa_y_avisa_cuando_la_rffm_lo_publica_tras_refrescar_la_jornada()
        {
            // 12:30 + 80' + 10' = 14:00 en Madrid: a las 14:05 ya ha podido terminar
            RffmRound1(Match("A1", "26/09/2026", "12:30"));
            await FollowAsync(LocalTeam);

            await RunAsync();
            Assert.Empty(Dispatched);

            RffmRound1(Match("A1", "26/09/2026", "12:30", "1", "3", "3"));
            _time.Advance(TimeSpan.FromMinutes(11));
            await RunAsync();

            var (_, message) = Assert.Single(Dispatched);
            Assert.Equal(("3", "3"), (message.LocalGoals, message.VisitorGoals));
        }

        [Fact]
        public async Task No_avisa_de_un_partido_que_aun_no_ha_podido_terminar()
        {
            RffmRound1(Match("A1", "26/09/2026", "13:30", "0", "1", "0"));
            await FollowAsync(LocalTeam);

            await RunAsync();

            Assert.Empty(Dispatched);
        }

        [Fact]
        public async Task No_avisa_de_partidos_terminados_hace_mas_de_48_horas()
        {
            RffmRound1(Match("A1", "26/09/2026", "10:00", "1", "2", "1"));
            await FollowAsync(LocalTeam);
            _time.Advance(TimeSpan.FromDays(3));

            await RunAsync();

            Assert.Empty(Dispatched);
        }

        [Fact]
        public async Task Avisa_de_un_partido_de_hoy_sin_hora_cuando_tiene_marcador()
        {
            RffmRound1(Match("A1", "26/09/2026", "", "1", "0", "2"));
            await FollowAsync(LocalTeam);

            await RunAsync();

            Assert.Single(Dispatched);
        }

        [Fact]
        public async Task Un_grupo_que_falla_no_impide_avisar_de_otro()
        {
            var failingGroup = Random.Shared.Next(10_000_000, 99_999_999).ToString();
            RffmRound1(Match("A1", "26/09/2026", "10:00", "1", "2", "1"));
            RffmRound1(failingGroup, Match("B1", "26/09/2026", "10:00", "1", "0", "0"));
            await FollowAsync(LocalTeam, failingGroup);
            var userId = await FollowAsync(LocalTeam);

            await RunAsync(inner => new FailingGroupSyncService(inner, int.Parse(failingGroup)));

            var (userIds, _) = Assert.Single(Dispatched);
            Assert.Equal(new[] { userId }, userIds);
        }
    }
}
