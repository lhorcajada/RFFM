using System;
using System.Linq;
using RFFM.Api.Domain.Entities.Federation.SquadHistory;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class SquadHistoryReportTests
    {
        private static SquadHistoryReport NewReport() =>
            SquadHistoryReport.Create("555", "CD Ejemplo A", 22, 21, "user-1");

        private static SquadHistoryEntry Entry(string playerCode) =>
            SquadHistoryEntry.Create(
                playerCode: playerCode, playerName: "JUGADOR", seasonId: 22, seasonName: "2026-2027",
                competitionCode: "10", competitionName: "Liga", groupCode: "20", groupName: "Grupo 1",
                teamCode: "555", teamName: "CD Ejemplo A", clubName: "CD Ejemplo", teamShieldUrl: null,
                teamPoints: 30, teamPosition: 1, goals: 2, yellowCards: 1, redCards: 0,
                starts: 5, callUps: 6, source: SquadHistorySource.PlayerSheet, isIncomplete: false);

        [Fact]
        public void Create_deja_el_informe_pendiente_y_suscribe_al_solicitante()
        {
            var report = NewReport();

            Assert.Equal(SquadHistoryStatus.Pending, report.Status);
            Assert.Equal(new[] { "user-1" }, report.Subscribers.Select(s => s.UserId));
        }

        [Theory]
        [InlineData("", "Equipo", "user")]
        [InlineData("555", "Equipo", "")]
        public void Create_falla_sin_equipo_o_usuario(string teamCode, string teamName, string userId)
        {
            Assert.Throws<ArgumentException>(() => SquadHistoryReport.Create(teamCode, teamName, 22, 21, userId));
        }

        [Fact]
        public void Subscribe_es_idempotente()
        {
            var report = NewReport();

            report.Subscribe("user-1");
            report.Subscribe("user-2");

            Assert.Equal(new[] { "user-1", "user-2" }, report.Subscribers.Select(s => s.UserId).OrderBy(x => x));
        }

        [Fact]
        public void RequestRefresh_de_un_informe_en_curso_no_requiere_encolar()
        {
            var report = NewReport();
            report.Start(10);

            var mustEnqueue = report.RequestRefresh("user-2");

            Assert.False(mustEnqueue);
            Assert.Equal(SquadHistoryStatus.Running, report.Status);
            Assert.Contains(report.Subscribers, s => s.UserId == "user-2");
        }

        [Fact]
        public void RequestRefresh_de_un_informe_completado_vuelve_a_pendiente_y_conserva_los_datos()
        {
            var report = NewReport();
            report.Start(1);
            report.Complete(new[] { Entry("1") });
            report.TakePendingNotifications();

            var mustEnqueue = report.RequestRefresh("user-1");

            Assert.True(mustEnqueue);
            Assert.Equal(SquadHistoryStatus.Pending, report.Status);
            Assert.Single(report.Entries);
            Assert.Equal(new[] { "user-1" }, report.TakePendingNotifications());
        }

        [Fact]
        public void Complete_reemplaza_las_entradas_y_marca_completado()
        {
            var report = NewReport();
            report.Start(2);
            report.Complete(new[] { Entry("1") });
            report.RequestRefresh("user-1");
            report.Start(2);

            report.Complete(new[] { Entry("2"), Entry("3") });

            Assert.Equal(SquadHistoryStatus.Completed, report.Status);
            Assert.Equal(new[] { "2", "3" }, report.Entries.Select(e => e.PlayerCode));
            Assert.NotNull(report.CompletedAt);
        }

        [Fact]
        public void ReportProgress_cuenta_procesados_y_fallidos()
        {
            var report = NewReport();
            report.Start(3);

            report.ReportProgress(playerFailed: false);
            report.ReportProgress(playerFailed: true);

            Assert.Equal((2, 1), (report.ProcessedPlayers, report.FailedPlayers));
        }

        [Fact]
        public void Fail_marca_el_error_y_conserva_las_entradas_previas()
        {
            var report = NewReport();
            report.Start(1);
            report.Complete(new[] { Entry("1") });
            report.RequestRefresh("user-1");

            report.Fail("Sin plantilla");

            Assert.Equal(SquadHistoryStatus.Failed, report.Status);
            Assert.Equal("Sin plantilla", report.ErrorMessage);
            Assert.Single(report.Entries);
        }

        [Fact]
        public void MarkAsCandidateSquad_marca_el_informe_y_Start_lo_reinicia()
        {
            var report = NewReport();
            report.Start(0);

            report.MarkAsCandidateSquad("Ficha del club no disponible");

            Assert.True(report.IsCandidateSquad);
            Assert.Equal("Ficha del club no disponible", report.CandidateSearchNote);

            report.Start(5);

            Assert.False(report.IsCandidateSquad);
            Assert.Null(report.CandidateSearchNote);
        }

        [Fact]
        public void Entry_guarda_anio_de_nacimiento_y_equipo_de_procedencia()
        {
            var entry = SquadHistoryEntry.Create(
                playerCode: "1", playerName: "JUGADOR", seasonId: 21, seasonName: "2025-2026",
                competitionCode: "10", competitionName: "Liga", groupCode: "20", groupName: "Grupo 1",
                teamCode: "555", teamName: "CD Ejemplo B", clubName: "CD Ejemplo", teamShieldUrl: null,
                teamPoints: 30, teamPosition: 1, goals: 2, yellowCards: 1, redCards: 0,
                starts: 5, callUps: 6, source: SquadHistorySource.PlayerSheet, isIncomplete: false,
                birthYear: 2012, originTeamName: "CD Ejemplo B");

            Assert.Equal((2012, "CD Ejemplo B"), (entry.BirthYear!.Value, entry.OriginTeamName));
        }

        [Fact]
        public void TakePendingNotifications_devuelve_cada_usuario_una_sola_vez()
        {
            var report = NewReport();
            report.Subscribe("user-2");

            var first = report.TakePendingNotifications();
            var second = report.TakePendingNotifications();

            Assert.Equal(new[] { "user-1", "user-2" }, first.OrderBy(x => x));
            Assert.Empty(second);
        }
    }
}
