#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Domain.Services.MatchSimulation;
using RFFM.Api.Features.Coaches.RivalStats;
using RFFM.Api.Features.Coaches.RivalStats.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class RivalRoundSimulationServiceTests
    {
        private static readonly DateTime Today = new(2026, 10, 22, 8, 0, 0, DateTimeKind.Utc);

        private readonly PostgresContainerFixture _fixture;
        private readonly RivalSimulationSeeder _seed;

        public RivalRoundSimulationServiceTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
            _seed = new RivalSimulationSeeder(fixture);
        }

        private async Task SyncAsync(DateTime now)
        {
            await using var db = _fixture.CreateFederationDbContext();
            var service = new RivalRoundSimulationService(db, new RivalSimulationInputLoader(db, Options.Create(new RffmOptions())),
                new FixedTimeProvider(now));
            await service.SyncAsync(_seed.League, CancellationToken.None);
        }

        private static List<MatchPredictionResponse> Matches(string json) =>
            JsonSerializer.Deserialize<List<MatchPredictionResponse>>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web))!;

        [Fact]
        public async Task Guarda_las_jornadas_jugadas_congeladas_y_la_proxima_abierta()
        {
            await _seed.SeedCalendarAsync();

            await SyncAsync(Today);

            var simulations = await _seed.LoadSimulationsAsync();
            Assert.Equal([1, 2, 3], simulations.Select(s => s.Round));
            Assert.Equal([true, true, false], simulations.Select(s => s.IsFrozen));
        }

        [Fact]
        public async Task Cada_jornada_solo_usa_los_resultados_de_las_anteriores()
        {
            await _seed.SeedCalendarAsync();

            await SyncAsync(Today);

            Assert.Equal([0, 2, 4], (await _seed.LoadSimulationsAsync()).Select(s => s.PlayedMatchesUsed));
        }

        [Fact]
        public async Task Guarda_las_predicciones_de_los_partidos_de_la_jornada_y_la_clasificacion()
        {
            await _seed.SeedCalendarAsync();

            await SyncAsync(Today);

            var round3 = (await _seed.LoadSimulationsAsync()).Single(s => s.Round == 3);
            Assert.Equal([("A", "D"), ("B", "C")], Matches(round3.MatchesJson).Select(m => (m.LocalTeamCode, m.VisitorTeamCode)));
            var standings = JsonSerializer.Deserialize<List<ProjectedStandingResponse>>(round3.StandingsJson,
                new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
            Assert.Equal(4, standings.Count);
        }

        [Fact]
        public async Task La_proxima_jornada_se_recalcula_si_cambia_un_resultado_anterior()
        {
            await _seed.SeedCalendarAsync();
            await SyncAsync(Today);
            var before = (await _seed.LoadSimulationsAsync()).Single(s => s.Round == 3);

            await _seed.SetRoundAsync(2, _seed.Match("3", "C", "A", "11/10/2026", "5", "0"), _seed.Match("4", "D", "B", "11/10/2026", "2", "0"));
            await SyncAsync(Today.AddHours(2));

            var after = (await _seed.LoadSimulationsAsync()).Single(s => s.Round == 3);
            Assert.Equal(Today.AddHours(2), after.ComputedAt);
            Assert.NotEqual(before.MatchesJson, after.MatchesJson);
        }

        [Fact]
        public async Task Al_empezar_la_jornada_se_congela_sin_recalcular()
        {
            await _seed.SeedCalendarAsync();
            await SyncAsync(Today);

            var roundStart = new DateTime(2026, 10, 25, 9, 0, 0, DateTimeKind.Utc);
            await SyncAsync(roundStart);

            var simulations = await _seed.LoadSimulationsAsync();
            var round3 = simulations.Single(s => s.Round == 3);
            Assert.Equal((true, Today, roundStart), (round3.IsFrozen, round3.ComputedAt, round3.FrozenAt!.Value));
            Assert.Equal([1, 2, 3, 4], simulations.Select(s => s.Round));
            Assert.False(simulations.Single(s => s.Round == 4).IsFrozen);
        }

        [Fact]
        public async Task Una_jornada_congelada_no_cambia_aunque_cambien_los_resultados()
        {
            await _seed.SeedCalendarAsync();
            await SyncAsync(Today);
            var before = (await _seed.LoadSimulationsAsync()).Single(s => s.Round == 2);

            await _seed.SetRoundAsync(1, _seed.Match("1", "A", "B", "04/10/2026", "0", "4"), _seed.Match("2", "C", "D", "04/10/2026", "1", "1"));
            await SyncAsync(Today.AddHours(2));

            var after = (await _seed.LoadSimulationsAsync()).Single(s => s.Round == 2);
            Assert.Equal((before.MatchesJson, before.ComputedAt), (after.MatchesJson, after.ComputedAt));
        }

        [Fact]
        public async Task Marca_como_rellenadas_solo_las_jornadas_calculadas_despues_de_empezar()
        {
            await _seed.SeedCalendarAsync();

            await SyncAsync(Today);

            var simulations = await _seed.LoadSimulationsAsync();
            Assert.Equal([true, true, false], simulations.Select(s => s.IsBackfilled));
            Assert.All(simulations, s => Assert.Equal(SeasonSimulator.ModelVersion, s.ModelVersion));
        }

        [Fact]
        public async Task Una_jornada_rellenada_con_una_version_antigua_se_recalcula()
        {
            await _seed.SeedCalendarAsync();
            await SeedOldSimulationAsync(round: 1, isBackfilled: true);

            await SyncAsync(Today);

            var round1 = (await _seed.LoadSimulationsAsync()).Single(s => s.Round == 1);
            Assert.Equal((SeasonSimulator.ModelVersion, true, true), (round1.ModelVersion, round1.IsFrozen, round1.IsBackfilled));
            Assert.Equal([("A", "B"), ("C", "D")], Matches(round1.MatchesJson).Select(m => (m.LocalTeamCode, m.VisitorTeamCode)));
        }

        [Fact]
        public async Task Una_jornada_congelada_en_su_momento_no_se_recalcula_aunque_cambie_la_version()
        {
            await _seed.SeedCalendarAsync();
            await SeedOldSimulationAsync(round: 1, isBackfilled: false);

            await SyncAsync(Today);

            var round1 = (await _seed.LoadSimulationsAsync()).Single(s => s.Round == 1);
            Assert.Equal((0, "[]"), (round1.ModelVersion, round1.MatchesJson));
        }

        private async Task SeedOldSimulationAsync(int round, bool isBackfilled)
        {
            await using var db = _fixture.CreateFederationDbContext();
            var simulation = RffmRoundSimulation.Create(_seed.GroupCode, RivalSimulationSeeder.Season, round,
                new RoundSimulationData(0, false, "[]", "[]"), 0, isBackfilled, Today.AddDays(-10));
            simulation.Freeze(Today.AddDays(-10));
            db.RffmRoundSimulations.Add(simulation);
            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task Sin_calendario_no_guarda_nada()
        {
            await SyncAsync(Today);

            Assert.Empty(await _seed.LoadSimulationsAsync());
        }
    }
}
