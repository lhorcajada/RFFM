using System;
using RFFM.Api.Features.Federation.LeagueSquadStats.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class WeeklyScheduleTests
    {
        private static readonly WeeklySchedule MondayAtOnePastMidnight = new(DayOfWeek.Monday, new TimeOnly(0, 1));

        private static DateTimeOffset Utc(int year, int month, int day, int hour, int minute) =>
            new(year, month, day, hour, minute, 0, TimeSpan.Zero);

        [Fact]
        public void NextRun_un_miercoles_es_el_lunes_siguiente_a_las_00_01_de_Madrid()
        {
            // Octubre de 2026: Madrid está en horario de verano (UTC+2) hasta el día 25.
            var next = MondayAtOnePastMidnight.NextRun(Utc(2026, 10, 14, 10, 0));

            Assert.Equal(Utc(2026, 10, 18, 22, 1), next);
        }

        [Fact]
        public void NextRun_el_lunes_antes_de_la_hora_es_ese_mismo_lunes()
        {
            var next = MondayAtOnePastMidnight.NextRun(Utc(2026, 10, 11, 22, 0));

            Assert.Equal(Utc(2026, 10, 11, 22, 1), next);
        }

        [Fact]
        public void NextRun_justo_a_la_hora_programada_es_la_semana_siguiente()
        {
            var next = MondayAtOnePastMidnight.NextRun(Utc(2026, 10, 11, 22, 1));

            Assert.Equal(Utc(2026, 10, 18, 22, 1), next);
        }

        [Fact]
        public void NextRun_tras_el_cambio_a_horario_de_invierno_usa_el_nuevo_desfase()
        {
            // El domingo 25-10-2026 Madrid pasa a UTC+1: el lunes 26 a las 00:01 son las 23:01 UTC del 25.
            var next = MondayAtOnePastMidnight.NextRun(Utc(2026, 10, 20, 12, 0));

            Assert.Equal(Utc(2026, 10, 25, 23, 1), next);
        }

        [Fact]
        public void NextRun_tras_el_cambio_a_horario_de_verano_usa_el_nuevo_desfase()
        {
            // El domingo 28-03-2027 Madrid pasa a UTC+2: el lunes 29 a las 00:01 son las 22:01 UTC del 28.
            var next = MondayAtOnePastMidnight.NextRun(Utc(2027, 3, 24, 12, 0));

            Assert.Equal(Utc(2027, 3, 28, 22, 1), next);
        }

        [Fact]
        public void LastRun_un_miercoles_es_el_lunes_de_esa_semana()
        {
            var last = MondayAtOnePastMidnight.LastRun(Utc(2026, 10, 14, 10, 0));

            Assert.Equal(Utc(2026, 10, 11, 22, 1), last);
        }

        [Fact]
        public void LastRun_el_lunes_antes_de_la_hora_es_el_lunes_anterior()
        {
            var last = MondayAtOnePastMidnight.LastRun(Utc(2026, 10, 11, 22, 0));

            Assert.Equal(Utc(2026, 10, 4, 22, 1), last);
        }

        [Fact]
        public void LastRun_justo_a_la_hora_programada_es_ese_instante()
        {
            var last = MondayAtOnePastMidnight.LastRun(Utc(2026, 10, 11, 22, 1));

            Assert.Equal(Utc(2026, 10, 11, 22, 1), last);
        }

        [Theory]
        [InlineData("00:01", 0, 1)]
        [InlineData("23:30", 23, 30)]
        [InlineData("no-es-una-hora", 0, 1)]
        public void From_interpreta_la_hora_configurada_y_usa_00_01_si_no_es_valida(string configured, int hour, int minute)
        {
            var schedule = WeeklySchedule.From(DayOfWeek.Monday, configured);

            Assert.Equal(new TimeOnly(hour, minute), schedule.Time);
        }
    }
}
