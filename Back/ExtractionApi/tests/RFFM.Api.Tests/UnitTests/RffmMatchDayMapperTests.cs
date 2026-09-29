using System.Text.Json;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Features.Federation.Competitions.Models.ApiRffm;
using RFFM.Api.Features.Federation.MatchResults.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class RffmMatchDayMapperTests
    {
        // Extracto real de https://www.rffm.es/api/results?idGroup=26738048&round=1 (29/09/2026)
        private const string ResultsJson = """
        {
          "estado": "1", "sesion_ok": "1",
          "nombre_competicion": "SUPERLIGA CADETE", "codigo_competicion": "26738047",
          "nombre_grupo": "Grupo Unico", "codigo_grupo": "26738048",
          "jornada": "1", "nombre_jornada": "1", "fecha_jornada": "26/09/2026",
          "listado_jornadas": [ { "estado": "1", "sesion_ok": "1", "jornadas": [
            { "codjornada": "1", "nombre": "1", "fecha_jornada": "26/09/2026" },
            { "codjornada": "2", "nombre": "2", "fecha_jornada": "03/10/2026" },
            { "codjornada": "x", "nombre": "?", "fecha_jornada": "" }
          ] } ],
          "partidos": [
            { "codacta": "5572725", "hay_actas": "1", "acta_cerrada": "1", "situacion_juego": "1",
              "observaciones": "", "fecha": "26/09/2026", "hora": "12:30",
              "campojuego": "VEREDA GANAPANES 1 (HA)", "codigo_campo": "14610183", "estado": "1",
              "motivo_estado": "", "partido_en_juego": "0", "ResultadoProvisional": "0",
              "arbitro": "MARTINEZ BACHILLER, DAVID", "penaltis": "", "ganado_et": "", "equipo_ganador_et": "",
              "CodEquipo_local": "1598", "Nombre_equipo_local": "A.D. UNION ADARVE 'A'",
              "url_img_local": "/pnfg/pimg/Clubes/adarve.jpg", "Retirado_local": "0",
              "Goles_casa": "1", "penaltis_casa": "",
              "CodEquipo_visitante": "8972474", "Nombre_equipo_visitante": "A.D. TORREJON C.F. 'A'",
              "url_img_visitante": "/pnfg/pimg/Clubes/torrejon.png", "Retirado_visitante": "0",
              "Goles_visitante": "0", "penaltis_visitante": "", "codacta_origen": "" },
            { "codacta": "5572741", "hay_actas": "0", "acta_cerrada": "0", "situacion_juego": "0",
              "observaciones": "", "fecha": "10/10/2026", "hora": "",
              "campojuego": "", "codigo_campo": "", "estado": "0", "motivo_estado": "",
              "partido_en_juego": "0", "ResultadoProvisional": "0", "arbitro": "", "penaltis": "",
              "ganado_et": "", "equipo_ganador_et": "",
              "CodEquipo_local": "8972474", "Nombre_equipo_local": "A.D. TORREJON C.F. 'A'",
              "url_img_local": "/pnfg/pimg/Clubes/torrejon.png", "Retirado_local": "0",
              "Goles_casa": "", "penaltis_casa": "",
              "CodEquipo_visitante": "1598", "Nombre_equipo_visitante": "A.D. UNION ADARVE 'A'",
              "url_img_visitante": "/pnfg/pimg/Clubes/adarve.jpg", "Retirado_visitante": "0",
              "Goles_visitante": "", "penaltis_visitante": "", "codacta_origen": "" }
          ]
        }
        """;

        private const string StandingsJson = """
        [ { "TeamId": "8972474", "Position": "1" }, { "TeamId": " 1598 ", "Position": "2" }, { "TeamId": "999", "Position": "-" } ]
        """;

        private static readonly DateTime SyncedAt = new(2026, 9, 29, 9, 0, 0, DateTimeKind.Utc);

        private static CalendarRffm Calendar() =>
            JsonSerializer.Deserialize<CalendarRffm>(ResultsJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;

        private static (RffmCompetitionGroup Group, List<RffmRound> Rounds) Persisted()
        {
            var calendar = Calendar();
            var group = RffmCompetitionGroup.Create("26738048", 22, calendar.CompetitionCode, calendar.CompetitionName,
                calendar.GroupName, 80, 2, null, SyncedAt);
            group.UpdateStandings(StandingsJson, 1, SyncedAt);
            var rounds = RffmMatchDayMapper.ToRoundInfos(calendar)
                .Select(r => RffmRound.Create("26738048", r.Number, r.Name, r.Date))
                .ToList();
            rounds.Single(r => r.Number == 1).ApplySnapshot(RffmMatchDayMapper.ToSnapshots(calendar), SyncedAt);
            return (group, rounds);
        }

        [Fact]
        public void Las_jornadas_con_codigo_no_numerico_se_ignoran()
        {
            var infos = RffmMatchDayMapper.ToRoundInfos(Calendar());

            Assert.Equal([1, 2], infos.Select(i => i.Number));
            Assert.Equal(new DateOnly(2026, 10, 3), infos[1].Date);
        }

        [Fact]
        public void La_respuesta_incluye_competicion_grupo_y_jornadas()
        {
            var (group, rounds) = Persisted();

            var response = RffmMatchDayMapper.ToResponse(26738048, 1, group, rounds);

            Assert.Equal(1, response.Round);
            Assert.Equal(26738048, response.GroupId);
            Assert.Equal("SUPERLIGA CADETE", response.CompetitionName);
            Assert.Equal("Grupo Unico", response.GroupName);
            Assert.Equal([1, 2], response.Rounds.Select(r => r.MatchDayNumber));
            Assert.Equal(new DateTime(2026, 10, 3), response.Rounds[1].Date);
            Assert.Equal(1, response.MatchDay.MatchDayNumber);
            Assert.Equal(new DateTime(2026, 9, 26), response.MatchDay.Date);
        }

        [Fact]
        public void Los_partidos_se_devuelven_igual_que_los_manda_la_rffm()
        {
            var (group, rounds) = Persisted();

            var match = RffmMatchDayMapper.ToResponse(26738048, 1, group, rounds).MatchDay.Matches[0];

            Assert.Equal("5572725", match.MatchRecordCode);
            Assert.Equal("1", match.RecordClosed);
            Assert.Equal(new DateTime(2026, 9, 26), match.Date);
            Assert.Equal("12:30", match.Time);
            Assert.Equal("VEREDA GANAPANES 1 (HA)", match.Field);
            Assert.Equal("MARTINEZ BACHILLER, DAVID", match.Referee);
            Assert.Equal("1", match.LocalGoals);
            Assert.Equal("0", match.VisitorGoals);
            Assert.Equal("https://appweb.rffm.es//pnfg/pimg/Clubes/adarve.jpg", match.LocalTeamImageUrl);
            Assert.Equal("https://appweb.rffm.es//pnfg/pimg/Clubes/torrejon.png", match.VisitorTeamImageUrl);
        }

        [Fact]
        public void Un_partido_sin_hora_ni_resultado_se_devuelve_con_campos_vacios()
        {
            var (group, rounds) = Persisted();

            var match = RffmMatchDayMapper.ToResponse(26738048, 1, group, rounds).MatchDay.Matches[1];

            Assert.Equal("5572741", match.MatchRecordCode);
            Assert.Equal(string.Empty, match.Time);
            Assert.Equal(string.Empty, match.LocalGoals);
        }

        [Fact]
        public void Las_posiciones_salen_de_la_clasificacion_guardada()
        {
            var (group, rounds) = Persisted();

            var match = RffmMatchDayMapper.ToResponse(26738048, 1, group, rounds).MatchDay.Matches[0];

            Assert.Equal(2, match.LocalTeamPosition);
            Assert.Equal(1, match.VisitorTeamPosition);
        }

        [Fact]
        public void Sin_clasificacion_las_posiciones_son_cero()
        {
            var calendar = Calendar();
            var group = RffmCompetitionGroup.Create("26738048", 22, "26738047", "SUPERLIGA CADETE", "Grupo Unico", 80, 2, null, SyncedAt);
            var round = RffmRound.Create("26738048", 1, "1", new DateOnly(2026, 9, 26));
            round.ApplySnapshot(RffmMatchDayMapper.ToSnapshots(calendar), SyncedAt);

            var match = RffmMatchDayMapper.ToResponse(26738048, 1, group, [round]).MatchDay.Matches[0];

            Assert.Equal(0, match.LocalTeamPosition);
        }

        [Fact]
        public void Una_jornada_sin_partidos_guardados_devuelve_la_jornada_vacia()
        {
            var (group, rounds) = Persisted();

            var response = RffmMatchDayMapper.ToResponse(26738048, 2, group, rounds);

            Assert.Empty(response.MatchDay.Matches);
            Assert.Equal(DateTime.MinValue, response.MatchDay.Date);
            Assert.Equal(2, response.MatchDay.MatchDayNumber);
        }
    }
}
