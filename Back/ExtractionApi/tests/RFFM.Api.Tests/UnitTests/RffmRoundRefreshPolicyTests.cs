using RFFM.Api.Domain.Entities.Federation.Results;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class RffmRoundRefreshPolicyTests
    {
        // 26/09/2026 14:05 en Madrid (CEST, UTC+2)
        private static readonly DateTime NowUtc = new(2026, 9, 26, 12, 5, 0, DateTimeKind.Utc);
        private static readonly RffmResultsRefreshSettings Settings = new();

        private static RffmRound RoundWith(DateTime syncedAtUtc, params RffmMatchSnapshot[] matches)
        {
            var round = RffmRound.Create("26738048", 1, "1", new DateOnly(2026, 9, 26));
            round.ApplySnapshot(matches, syncedAtUtc);
            return round;
        }

        private static RffmMatchSnapshot Match(string date, string time, string recordClosed = "0") =>
            new() { RecordCode = "5572725", Date = date, Time = time, RecordClosed = recordClosed };

        private static RoundRefreshReason Evaluate(RffmRound round, int minutes = 80, int parts = 2) =>
            RffmRoundRefreshPolicy.Evaluate(round, minutes, parts, NowUtc, Settings);

        [Fact]
        public void Una_jornada_nunca_sincronizada_se_descarga()
        {
            var round = RffmRound.Create("26738048", 1, "1", new DateOnly(2026, 9, 26));

            Assert.Equal(RoundRefreshReason.NeverSynced, Evaluate(round));
        }

        [Fact]
        public void Partido_sin_hora_consultado_hace_menos_de_6_horas_no_se_refresca()
        {
            var round = RoundWith(NowUtc.AddHours(-5), Match("10/10/2026", ""));

            Assert.Equal(RoundRefreshReason.None, Evaluate(round));
        }

        [Fact]
        public void Partido_sin_hora_consultado_hace_mas_de_6_horas_se_refresca()
        {
            var round = RoundWith(NowUtc.AddHours(-7), Match("10/10/2026", ""));

            Assert.Equal(RoundRefreshReason.MissingSchedule, Evaluate(round));
        }

        [Fact]
        public void Partido_sin_fecha_ni_hora_consultado_hace_mas_de_6_horas_se_refresca()
        {
            var round = RoundWith(NowUtc.AddHours(-7), Match("", ""));

            Assert.Equal(RoundRefreshReason.MissingSchedule, Evaluate(round));
        }

        [Fact]
        public void Partido_de_80_minutos_iniciado_a_las_1230_ha_podido_terminar_a_las_1405()
        {
            var round = RoundWith(NowUtc.AddHours(-1), Match("26/09/2026", "12:30"));

            Assert.Equal(RoundRefreshReason.AwaitingResult, Evaluate(round, minutes: 80));
        }

        [Fact]
        public void Partido_de_90_minutos_iniciado_a_las_1230_no_ha_podido_terminar_a_las_1405()
        {
            var round = RoundWith(NowUtc.AddHours(-1), Match("26/09/2026", "12:30"));

            Assert.Equal(RoundRefreshReason.None, Evaluate(round, minutes: 90));
        }

        [Fact]
        public void Partido_terminado_sin_acta_consultado_hace_menos_de_10_minutos_no_se_refresca()
        {
            var round = RoundWith(NowUtc.AddMinutes(-5), Match("26/09/2026", "12:30"));

            Assert.Equal(RoundRefreshReason.None, Evaluate(round));
        }

        [Fact]
        public void Partido_con_acta_cerrada_no_provoca_refresco()
        {
            var round = RoundWith(NowUtc.AddDays(-3), Match("26/09/2026", "12:30", recordClosed: "1"));

            Assert.Equal(RoundRefreshReason.None, Evaluate(round));
        }

        [Fact]
        public void Partido_terminado_hace_mas_de_48_horas_sin_acta_solo_se_refresca_una_vez_al_dia()
        {
            var round = RoundWith(NowUtc.AddHours(-2), Match("22/09/2026", "12:30"));

            Assert.Equal(RoundRefreshReason.None, Evaluate(round));
        }

        [Fact]
        public void Partido_terminado_hace_mas_de_48_horas_sin_acta_consultado_hace_mas_de_un_dia_se_refresca()
        {
            var round = RoundWith(NowUtc.AddHours(-25), Match("22/09/2026", "12:30"));

            Assert.Equal(RoundRefreshReason.AwaitingResult, Evaluate(round));
        }

        [Fact]
        public void Partido_en_los_proximos_7_dias_consultado_hace_mas_de_un_dia_se_revisa()
        {
            var round = RoundWith(NowUtc.AddHours(-25), Match("29/09/2026", "18:00"));

            Assert.Equal(RoundRefreshReason.UpcomingRecheck, Evaluate(round));
        }

        [Fact]
        public void Partido_en_los_proximos_7_dias_consultado_hoy_no_se_revisa()
        {
            var round = RoundWith(NowUtc.AddHours(-2), Match("29/09/2026", "18:00"));

            Assert.Equal(RoundRefreshReason.None, Evaluate(round));
        }

        [Fact]
        public void Partido_a_mas_de_7_dias_no_se_revisa()
        {
            var round = RoundWith(NowUtc.AddDays(-3), Match("10/10/2026", "18:00"));

            Assert.Equal(RoundRefreshReason.None, Evaluate(round));
        }

        [Fact]
        public void El_fin_estimado_suma_el_descanso_entre_partes()
        {
            // 60' en 2 partes: 12:30 + 60 + 10 = 13:40 → terminado a las 14:05
            var round = RoundWith(NowUtc.AddHours(-1), Match("26/09/2026", "12:30"));

            Assert.Equal(RoundRefreshReason.AwaitingResult, Evaluate(round, minutes: 60, parts: 2));
        }

        [Fact]
        public void EstimatedEndUtc_suma_duracion_y_descanso_a_la_hora_de_inicio_de_Madrid()
        {
            // 12:30 en Madrid (10:30 UTC) + 80' + 10' de descanso = 12:00 UTC
            var round = RoundWith(NowUtc.AddHours(-1), Match("26/09/2026", "12:30"));

            var end = RffmRoundRefreshPolicy.EstimatedEndUtc(Assert.Single(round.Matches), 80, 2, Settings);

            Assert.Equal(new DateTime(2026, 9, 26, 12, 0, 0, DateTimeKind.Utc), end);
        }

        [Fact]
        public void EstimatedEndUtc_es_nulo_sin_hora_de_inicio()
        {
            var round = RoundWith(NowUtc.AddHours(-1), Match("26/09/2026", ""));

            Assert.Null(RffmRoundRefreshPolicy.EstimatedEndUtc(Assert.Single(round.Matches), 80, 2, Settings));
        }
    }
}
