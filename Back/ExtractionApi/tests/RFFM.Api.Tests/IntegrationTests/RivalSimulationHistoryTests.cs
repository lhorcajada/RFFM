#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain;
using RFFM.Api.Features.Coaches.RivalStats;
using RFFM.Api.Features.Coaches.RivalStats.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class RivalSimulationHistoryTests
    {
        private static readonly DateTime Today = new(2026, 10, 22, 8, 0, 0, DateTimeKind.Utc);

        private readonly PostgresContainerFixture _fixture;
        private readonly RivalSimulationSeeder _seed;

        public RivalSimulationHistoryTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
            _seed = new RivalSimulationSeeder(fixture);
        }

        private async Task SyncAsync(string teamId, DateTime? now = null)
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var db = _fixture.CreateFederationDbContext();
            var options = Options.Create(new RffmOptions());
            var service = new RivalRoundSimulationService(db, new RivalSimulationInputLoader(db, options), new FixedTimeProvider(now ?? Today));
            var handler = new SyncRivalSimulationRounds.Handler(appDb, service, options);
            await handler.Handle(new SyncRivalSimulationRounds.SyncRivalSimulationRoundsCommand(teamId), CancellationToken.None);
        }

        private async Task<GetRivalSimulationHistory.RivalSimulationHistoryResponse> HistoryAsync(string teamId)
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var db = _fixture.CreateFederationDbContext();
            var options = Options.Create(new RffmOptions());
            var handler = new GetRivalSimulationHistory.Handler(appDb, db, new RivalSimulationInputLoader(db, options), options,
                new FixedTimeProvider(Today));
            return await handler.Handle(new GetRivalSimulationHistory.RivalSimulationHistoryQuery(teamId), CancellationToken.None);
        }

        [Fact]
        public async Task Devuelve_las_jornadas_guardadas_en_orden_con_su_estado()
        {
            var teamId = await _seed.SeedTeamAsync();
            await _seed.SeedCalendarAsync();
            await SyncAsync(teamId);

            var history = await HistoryAsync(teamId);

            Assert.Equal("A", history.OwnTeamCode);
            Assert.Equal([(1, "Played", true, true), (2, "Played", true, true), (3, "Upcoming", false, false)],
                history.Rounds.Select(r => (r.Round, r.Status, r.IsFrozen, r.IsBackfilled)));
            Assert.Equal(new DateOnly(2026, 10, 4), history.Rounds[0].Date);
        }

        [Fact]
        public async Task Compara_cada_prediccion_con_el_resultado_real()
        {
            var teamId = await _seed.SeedTeamAsync();
            await _seed.SeedCalendarAsync();
            await SyncAsync(teamId);

            var history = await HistoryAsync(teamId);

            var round1 = history.Rounds[0];
            var aVsB = round1.Matches.Single(m => m.LocalTeamCode == "A");
            Assert.Equal((2, 0, "Home"), (aVsB.ActualLocalGoals!.Value, aVsB.ActualVisitorGoals!.Value, aVsB.ActualOutcome));
            Assert.Equal(aVsB.PredictedOutcome == "Home", aVsB.Hit);
            var cVsD = round1.Matches.Single(m => m.LocalTeamCode == "C");
            Assert.Equal("Draw", cVsD.ActualOutcome);
            Assert.Equal(cVsD.PredictedOutcome == "Draw", cVsD.Hit);
            Assert.Equal(round1.Matches.Count(m => m.Hit == true), round1.Hits);
            Assert.Equal(2, round1.Evaluated);
        }

        [Fact]
        public async Task Los_partidos_pendientes_no_se_evaluan()
        {
            var teamId = await _seed.SeedTeamAsync();
            await _seed.SeedCalendarAsync();
            await SyncAsync(teamId);

            var round3 = (await HistoryAsync(teamId)).Rounds.Single(r => r.Round == 3);

            Assert.All(round3.Matches, m => Assert.Equal((null, null, null, null),
                (m.ActualLocalGoals, m.ActualVisitorGoals, m.ActualOutcome, m.Hit)));
            Assert.Equal((0, 0), (round3.Hits, round3.Evaluated));
            Assert.Contains(round3.Matches[0].PredictedOutcome, new[] { "Home", "Draw", "Away" });
        }

        [Fact]
        public async Task Suma_los_aciertos_de_todas_las_jornadas()
        {
            var teamId = await _seed.SeedTeamAsync();
            await _seed.SeedCalendarAsync();
            await SyncAsync(teamId);

            var history = await HistoryAsync(teamId);

            Assert.Equal(4, history.TotalEvaluated);
            Assert.Equal(history.Rounds.Sum(r => r.Hits), history.TotalHits);
        }

        [Fact]
        public async Task La_clasificacion_guardada_incluye_el_puesto_y_los_puntos_reales_actuales()
        {
            var teamId = await _seed.SeedTeamAsync();
            await _seed.SeedCalendarAsync();
            await SyncAsync(teamId);

            var round1 = (await HistoryAsync(teamId)).Rounds[0];

            // Tras dos jornadas A suma 6 puntos y es primero.
            var a = round1.Standings.Single(s => s.TeamCode == "A");
            Assert.Equal((1, 6), (a.ActualPosition!.Value, a.ActualPoints!.Value));
            Assert.Equal(4, round1.Standings.Count);
        }

        [Fact]
        public async Task Sin_calendario_el_historial_esta_vacio()
        {
            var teamId = await _seed.SeedTeamAsync();
            await SyncAsync(teamId);

            var history = await HistoryAsync(teamId);

            Assert.Empty(history.Rounds);
            Assert.Equal((0, 0), (history.TotalHits, history.TotalEvaluated));
        }

        [Fact]
        public async Task Un_equipo_sin_competicion_lanza_conflicto_al_sincronizar_y_al_consultar()
        {
            var teamId = await _seed.SeedTeamAsync(withLeague: false);

            await Assert.ThrowsAsync<ConflictException>(() => SyncAsync(teamId));
            await Assert.ThrowsAsync<ConflictException>(() => HistoryAsync(teamId));
        }

        [Fact]
        public void El_validador_exige_el_equipo()
        {
            var result = new SyncRivalSimulationRounds.Validator().Validate(new SyncRivalSimulationRounds.SyncRivalSimulationRoundsCommand(" "));

            Assert.False(result.IsValid);
        }
    }
}
