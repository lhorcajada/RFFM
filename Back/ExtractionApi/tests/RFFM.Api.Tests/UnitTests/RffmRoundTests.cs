using RFFM.Api.Domain.Entities.Federation.Results;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class RffmRoundTests
    {
        private static readonly DateTime SyncedAt = new(2026, 9, 26, 12, 0, 0, DateTimeKind.Utc);

        private static RffmRound NewRound() => RffmRound.Create("26738048", 1, "1", new DateOnly(2026, 9, 26));

        private static RffmMatchSnapshot Match(string recordCode, string recordClosed = "0", string time = "12:30",
            string localGoals = "") =>
            new()
            {
                RecordCode = recordCode, Date = "26/09/2026", Time = time, RecordClosed = recordClosed,
                LocalTeamCode = "1598", LocalTeamName = "A.D. UNION ADARVE 'A'", LocalGoals = localGoals,
                VisitorTeamCode = "8972474", VisitorTeamName = "A.D. TORREJON C.F. 'A'"
            };

        [Fact]
        public void La_primera_sincronizacion_crea_los_partidos_con_fecha_y_hora()
        {
            var round = NewRound();

            var result = round.ApplySnapshot([Match("5572725")], SyncedAt);

            Assert.True(result.Changed);
            var match = Assert.Single(round.Matches);
            Assert.Equal(new DateOnly(2026, 9, 26), match.MatchDate);
            Assert.Equal(new TimeOnly(12, 30), match.KickoffTime);
            Assert.Equal(SyncedAt, round.LastSyncedAt);
        }

        [Fact]
        public void Un_partido_sin_hora_queda_sin_hora_de_inicio()
        {
            var round = NewRound();

            round.ApplySnapshot([Match("5572725", time: "")], SyncedAt);

            Assert.Null(Assert.Single(round.Matches).KickoffTime);
        }

        [Fact]
        public void Sincronizar_los_mismos_datos_no_marca_cambios_pero_actualiza_la_fecha_de_consulta()
        {
            var round = NewRound();
            round.ApplySnapshot([Match("5572725")], SyncedAt);

            var result = round.ApplySnapshot([Match("5572725")], SyncedAt.AddHours(1));

            Assert.False(result.Changed);
            Assert.Equal(SyncedAt.AddHours(1), round.LastSyncedAt);
        }

        [Fact]
        public void Un_partido_que_pasa_a_acta_cerrada_se_notifica_como_nuevo_definitivo()
        {
            var round = NewRound();
            round.ApplySnapshot([Match("5572725")], SyncedAt);

            var result = round.ApplySnapshot([Match("5572725", recordClosed: "1", localGoals: "1")], SyncedAt.AddHours(2));

            Assert.True(result.Changed);
            Assert.Equal(["5572725"], result.NewlyFinalRecordCodes);
            Assert.Equal("1", Assert.Single(round.Matches).LocalGoals);
        }

        [Fact]
        public void Un_partido_ya_cerrado_en_la_primera_sincronizacion_es_nuevo_definitivo()
        {
            var round = NewRound();

            var result = round.ApplySnapshot([Match("5572725", recordClosed: "1")], SyncedAt);

            Assert.Equal(["5572725"], result.NewlyFinalRecordCodes);
        }

        [Fact]
        public void Un_partido_que_ya_estaba_cerrado_no_vuelve_a_notificarse()
        {
            var round = NewRound();
            round.ApplySnapshot([Match("5572725", recordClosed: "1")], SyncedAt);

            var result = round.ApplySnapshot([Match("5572725", recordClosed: "1")], SyncedAt.AddHours(1));

            Assert.Empty(result.NewlyFinalRecordCodes);
        }

        [Fact]
        public void Un_partido_que_ya_no_esta_en_la_jornada_se_elimina()
        {
            var round = NewRound();
            round.ApplySnapshot([Match("5572725"), Match("5572726")], SyncedAt);

            var result = round.ApplySnapshot([Match("5572725")], SyncedAt.AddHours(1));

            Assert.True(result.Changed);
            Assert.Equal("5572725", Assert.Single(round.Matches).RecordCode);
        }

        [Fact]
        public void Los_partidos_conservan_el_orden_de_la_rffm()
        {
            var round = NewRound();
            round.ApplySnapshot([Match("5572725"), Match("5572726")], SyncedAt);

            round.ApplySnapshot([Match("5572726"), Match("5572725")], SyncedAt.AddHours(1));

            Assert.Equal(["5572726", "5572725"], round.Matches.OrderBy(m => m.SortOrder).Select(m => m.RecordCode));
        }

        [Fact]
        public void Una_jornada_vacia_de_la_rffm_no_borra_los_partidos_guardados()
        {
            var round = NewRound();
            round.ApplySnapshot([Match("5572725")], SyncedAt);

            var result = round.ApplySnapshot([], SyncedAt.AddHours(1));

            Assert.False(result.Changed);
            Assert.Single(round.Matches);
        }

        [Fact]
        public void Actualizar_la_informacion_de_la_jornada_cambia_nombre_y_fecha()
        {
            var round = NewRound();

            round.UpdateInfo("Jornada 1", new DateOnly(2026, 9, 27));

            Assert.Equal("Jornada 1", round.Name);
            Assert.Equal(new DateOnly(2026, 9, 27), round.Date);
        }
    }
}
