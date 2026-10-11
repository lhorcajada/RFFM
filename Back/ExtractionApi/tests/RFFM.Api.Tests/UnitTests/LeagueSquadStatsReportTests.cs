using System;
using System.Linq;
using RFFM.Api.Domain.Entities.Federation.LeagueSquadStats;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class LeagueSquadStatsReportTests
    {
        private static readonly DateTime Now = new(2026, 10, 12, 8, 0, 0, DateTimeKind.Utc);
        private static readonly TimeSpan MinInterval = TimeSpan.FromMinutes(60);

        private static LeagueSquadStatsReport NewReport() =>
            LeagueSquadStatsReport.Create(22, 21, "555", "777", Now);

        private static LeagueSquadTeamData Team(string teamCode, params string[] playerCodes) =>
            new(teamCode, $"Equipo {teamCode}", null,
                playerCodes.Select(c => new LeagueSquadPlayerData(c, $"JUGADOR {c}")).ToList());

        private static LeagueSquadStatsReport CompletedReport(DateTime completedAt)
        {
            var report = NewReport();
            report.Start(Now);
            report.ReplaceSquads(new[] { Team("E1", "P1") });
            report.Complete(completedAt);
            return report;
        }

        [Fact]
        public void Create_deja_el_informe_pendiente_sin_suscriptores()
        {
            var report = NewReport();

            Assert.Equal(LeagueSquadStatsStatus.Pending, report.Status);
            Assert.Equal((22, 21, "555", "777"), (report.SeasonId, report.PreviousSeasonId!.Value, report.CompetitionCode, report.GroupCode));
            Assert.Empty(report.Subscribers);
        }

        [Theory]
        [InlineData("", "777")]
        [InlineData("555", " ")]
        public void Create_falla_sin_competicion_o_grupo(string competitionCode, string groupCode)
        {
            Assert.Throws<ArgumentException>(() => LeagueSquadStatsReport.Create(22, 21, competitionCode, groupCode, Now));
        }

        [Fact]
        public void Subscribe_es_idempotente_por_usuario()
        {
            var report = NewReport();

            report.Subscribe("user-1", "team-1");
            report.Subscribe("user-1", "team-2");

            var subscriber = Assert.Single(report.Subscribers);
            Assert.Equal("team-2", subscriber.TeamId);
        }

        [Fact]
        public void TakePendingNotifications_devuelve_cada_suscriptor_una_sola_vez()
        {
            var report = NewReport();
            report.Subscribe("user-1", "team-1");

            var first = report.TakePendingNotifications();
            var second = report.TakePendingNotifications();

            Assert.Equal(new[] { ("user-1", "team-1") }, first.Select(r => (r.UserId, r.TeamId)));
            Assert.Empty(second);
        }

        [Fact]
        public void Subscribe_de_nuevo_vuelve_a_dejar_pendiente_la_notificacion()
        {
            var report = NewReport();
            report.Subscribe("user-1", "team-1");
            report.TakePendingNotifications();

            report.Subscribe("user-1", "team-1");

            Assert.Single(report.TakePendingNotifications());
        }

        [Fact]
        public void RequestRefresh_no_reencola_un_informe_en_curso()
        {
            var report = NewReport();
            report.Start(Now);

            Assert.False(report.RequestRefresh(Now.AddMinutes(5)));
            Assert.Equal(LeagueSquadStatsStatus.Running, report.Status);
        }

        [Fact]
        public void RequestRefresh_deja_pendiente_un_informe_completado()
        {
            var report = CompletedReport(Now);
            var later = Now.AddHours(2);

            Assert.True(report.RequestRefresh(later));
            Assert.Equal(LeagueSquadStatsStatus.Pending, report.Status);
            Assert.Equal(later, report.RequestedAt);
        }

        [Fact]
        public void CanRefresh_es_falso_antes_del_intervalo_minimo()
        {
            var report = CompletedReport(Now);

            Assert.False(report.CanRefresh(Now.AddMinutes(59), MinInterval));
            Assert.Equal(Now.AddMinutes(60), report.NextRefreshAllowedAt(MinInterval));
        }

        [Fact]
        public void CanRefresh_es_cierto_tras_el_intervalo_minimo()
        {
            var report = CompletedReport(Now);

            Assert.True(report.CanRefresh(Now.AddMinutes(60), MinInterval));
        }

        [Fact]
        public void CanRefresh_es_cierto_para_un_informe_fallido()
        {
            var report = CompletedReport(Now);
            report.RequestRefresh(Now.AddHours(2));
            report.Start(Now.AddHours(2));
            report.Fail("boom");

            Assert.True(report.CanRefresh(Now.AddHours(2).AddMinutes(1), MinInterval));
        }

        [Fact]
        public void Start_reinicia_el_progreso()
        {
            var report = NewReport();
            report.Start(Now);
            report.SetTotals(3);
            report.RegisterPlayerProcessed(failed: true);

            report.Start(Now.AddDays(7));

            Assert.Equal((LeagueSquadStatsStatus.Running, 0, 0, 0),
                (report.Status, report.TotalPlayers, report.ProcessedPlayers, report.FailedPlayers));
        }

        [Fact]
        public void RegisterPlayerProcessed_cuenta_procesados_y_fallidos()
        {
            var report = NewReport();
            report.Start(Now);
            report.SetTotals(2);

            report.RegisterPlayerProcessed(failed: false);
            report.RegisterPlayerProcessed(failed: true);

            Assert.Equal((2, 2, 1), (report.TotalPlayers, report.ProcessedPlayers, report.FailedPlayers));
        }

        [Fact]
        public void ReplaceSquads_sustituye_equipos_y_jugadores()
        {
            var report = NewReport();
            report.ReplaceSquads(new[] { Team("E1", "P1", "P2"), Team("E2", "P3") });

            report.ReplaceSquads(new[] { Team("E1", "P2", "P4") });

            var team = Assert.Single(report.Teams);
            Assert.Equal("E1", team.TeamCode);
            Assert.Equal(new[] { "P2", "P4" }, team.Players.Select(p => p.PlayerCode));
        }

        [Fact]
        public void Complete_fija_la_fecha_de_ultima_actualizacion()
        {
            var report = CompletedReport(Now.AddMinutes(12));

            Assert.Equal(LeagueSquadStatsStatus.Completed, report.Status);
            Assert.Equal(Now.AddMinutes(12), report.CompletedAt);
            Assert.Null(report.ErrorMessage);
        }

        [Fact]
        public void Fail_conserva_los_equipos_y_la_ultima_actualizacion_correcta()
        {
            var report = CompletedReport(Now);
            report.RequestRefresh(Now.AddDays(7));
            report.Start(Now.AddDays(7));

            report.Fail("No se pudieron obtener los equipos del grupo.");

            Assert.Equal(LeagueSquadStatsStatus.Failed, report.Status);
            Assert.Equal("No se pudieron obtener los equipos del grupo.", report.ErrorMessage);
            Assert.Equal(Now, report.CompletedAt);
            Assert.Single(report.Teams);
        }
    }
}
