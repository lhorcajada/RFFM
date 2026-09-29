#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Features.Federation.Competitions.Models;
using RFFM.Api.Features.Federation.MatchResults.Services;
using RFFM.Api.Features.Federation.SquadHistory.Services;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class RffmResultsWorkerTests
    {
        private static readonly DateTime Now = new(2026, 9, 26, 18, 0, 0, DateTimeKind.Utc);

        private readonly PostgresContainerFixture _fixture;
        private readonly FakeRffmBackgroundClient _client = new();
        private readonly string _groupCode = Random.Shared.Next(10_000_000, 99_999_999).ToString();

        public RffmResultsWorkerTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private string NewRecordCode() => $"{_groupCode}-{Guid.NewGuid():N}"[..30];

        private RffmResultsJobProcessor CreateProcessor(FederationDbContext db) =>
            new(db, _client, new MutableTimeProvider(Now), NullLogger<RffmResultsJobProcessor>.Instance);

        private async Task ProcessAsync(RffmResultsJob job)
        {
            await using var db = _fixture.CreateFederationDbContext();
            await CreateProcessor(db).ProcessAsync(job, CancellationToken.None);
        }

        private static MatchRffm Acta(string recordCode) => new()
        {
            MatchRecordCode = recordCode,
            LocalTeam = "A.D. UNION ADARVE 'A'",
            LocalGoals = "1",
            LocalPlayers = [new LineupPlayer { PlayerCode = "111", PlayerName = "JUGADOR UNO", Starter = "1" }],
            LocalCards = [new Card { PlayerCode = "111", CardType = "100", Minute = "35" }]
        };

        private async Task SeedGroupAsync(params RffmMatchSnapshot[] matches)
        {
            await using var db = _fixture.CreateFederationDbContext();
            db.RffmCompetitionGroups.Add(RffmCompetitionGroup.Create(_groupCode, 22, "26738047", "SUPERLIGA CADETE", "Grupo Unico", 80, 2, Now));
            var round = RffmRound.Create(_groupCode, 1, "1", new DateOnly(2026, 9, 26));
            round.ApplySnapshot(matches, Now);
            db.RffmRounds.Add(round);
            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task Descarga_y_guarda_el_acta_completa()
        {
            var recordCode = NewRecordCode();
            _client.Actas[recordCode] = Acta(recordCode);

            await ProcessAsync(new FetchMatchRecordJob(recordCode, 22, "26738047", _groupCode));

            await using var db = _fixture.CreateFederationDbContext();
            var stored = await db.RffmMatchRecords.SingleAsync(r => r.RecordCode == recordCode);
            var acta = JsonSerializer.Deserialize<MatchRffm>(stored.PayloadJson)!;
            Assert.Equal("A.D. UNION ADARVE 'A'", acta.LocalTeam);
            Assert.Equal("JUGADOR UNO", Assert.Single(acta.LocalPlayers).PlayerName);
            Assert.Equal("100", Assert.Single(acta.LocalCards).CardType);
        }

        [Fact]
        public async Task Un_acta_ya_guardada_no_se_vuelve_a_pedir()
        {
            var recordCode = NewRecordCode();
            _client.Actas[recordCode] = Acta(recordCode);
            await ProcessAsync(new FetchMatchRecordJob(recordCode, 22, "26738047", _groupCode));

            await ProcessAsync(new FetchMatchRecordJob(recordCode, 22, "26738047", _groupCode));

            Assert.Equal(1, _client.ActaCalls[recordCode]);
        }

        [Fact]
        public async Task Si_la_rffm_no_devuelve_el_acta_no_se_guarda_nada()
        {
            var recordCode = NewRecordCode();

            await ProcessAsync(new FetchMatchRecordJob(recordCode, 22, "26738047", _groupCode));

            await using var db = _fixture.CreateFederationDbContext();
            Assert.False(await db.RffmMatchRecords.AnyAsync(r => r.RecordCode == recordCode));
        }

        [Fact]
        public async Task Actualiza_la_clasificacion_del_grupo()
        {
            await SeedGroupAsync();
            _client.Standings[_groupCode] = [new TeamResponse { TeamId = "1598", Position = "3", TeamName = "ADARVE", Points = "7" }];

            await ProcessAsync(new RefreshStandingsJob(_groupCode, 1));

            await using var db = _fixture.CreateFederationDbContext();
            var group = await db.RffmCompetitionGroups.SingleAsync(g => g.GroupCode == _groupCode);
            var teams = JsonSerializer.Deserialize<List<TeamResponse>>(group.StandingsJson!)!;
            Assert.Equal("7", Assert.Single(teams).Points);
            Assert.Equal(Now, group.StandingsSyncedAt);
            Assert.Contains((_groupCode, 1), _client.RequestedStandings);
        }

        [Fact]
        public async Task Al_arrancar_encola_las_actas_cerradas_que_faltan()
        {
            var pending = NewRecordCode();
            var open = NewRecordCode();
            await SeedGroupAsync(
                new RffmMatchSnapshot { RecordCode = pending, RecordClosed = "1", HasRecords = "1" },
                new RffmMatchSnapshot { RecordCode = open, RecordClosed = "0" });
            _client.Actas[pending] = Acta(pending);

            var services = new ServiceCollection();
            services.AddDbContext<FederationDbContext>(o => o.UseNpgsql(_fixture.ConnectionString,
                npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "federation")));
            services.AddScoped<IRffmBackgroundClient>(_ => _client);
            services.AddSingleton<TimeProvider>(new MutableTimeProvider(Now));
            services.AddLogging();
            services.AddScoped<RffmResultsJobProcessor>();
            var provider = services.BuildServiceProvider();
            var worker = new RffmResultsWorker(new RffmResultsJobQueue(), provider.GetRequiredService<IServiceScopeFactory>(),
                NullLogger<RffmResultsWorker>.Instance);

            using var cts = new CancellationTokenSource();
            await worker.StartAsync(cts.Token);
            var timeout = DateTime.UtcNow.AddSeconds(10);
            while (!_client.ActaCalls.ContainsKey(pending) && DateTime.UtcNow < timeout)
                await Task.Delay(50);
            await worker.StopAsync(CancellationToken.None);

            Assert.True(_client.ActaCalls.ContainsKey(pending));
            Assert.False(_client.ActaCalls.ContainsKey(open));
        }
    }
}
