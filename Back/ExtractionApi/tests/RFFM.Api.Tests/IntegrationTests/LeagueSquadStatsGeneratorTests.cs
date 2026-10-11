#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using RFFM.Api.Domain.Entities.Federation.LeagueSquadStats;
using RFFM.Api.Features.Coaches.Notifications.Services;
using RFFM.Api.Features.Federation.LeagueSquadStats.Services;
using RFFM.Api.Features.Federation.Players.Models;
using RFFM.Api.Features.Federation.SquadHistory.Services;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class LeagueSquadStatsGeneratorTests
    {
        private const int Season = 22;
        private const int PreviousSeason = 21;
        private static readonly DateTime Now = new(2026, 10, 12, 8, 0, 0, DateTimeKind.Utc);

        private readonly PostgresContainerFixture _fixture;
        private readonly Mock<IWebPushNotificationDispatcher> _notifications = new();
        private readonly string _group = $"G{Guid.NewGuid():N}"[..12];
        private readonly string _prefix = Guid.NewGuid().ToString("N")[..8];

        public LeagueSquadStatsGeneratorTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private string P(string code) => $"{_prefix}-{code}";

        private static TeamRffm Roster(params string[] playerCodes) => new()
        {
            ClubShield = "escudo.png",
            Players = playerCodes.Select(c => new TeamPlayerRffm { PlayerCode = c, Name = $"JUGADOR {c}" }).ToList()
        };

        private static Player Sheet(int called = 10, int goals = 3) => new()
        {
            Name = "JUGADOR FICHA",
            BirthYear = 2012,
            Matches = new MatchStatistics { Called = called, Starter = 8, Played = called, TotalGoals = goals },
            Cards = new CardStatistics { Yellow = 1 },
            Competitions = new List<CompetitionParticipation>
            {
                new() { CompetitionName = "Liga", GroupName = "Grupo 1", TeamCode = "E1", TeamName = "Equipo E1", TeamPoints = 30, TeamPosition = 2 }
            }
        };

        private FakeRffmBackgroundClient ClientWith(params (string TeamCode, string[] Players)[] teams)
        {
            var client = new FakeRffmBackgroundClient();
            client.GroupTeams[_group] = teams.Select(t => new RffmGroupTeam(t.TeamCode, $"Equipo {t.TeamCode}")).ToList();
            foreach (var (teamCode, players) in teams)
            {
                client.Rosters[teamCode] = Roster(players);
                foreach (var player in players)
                foreach (var season in new[] { Season, PreviousSeason })
                    client.Sheets[(player, season)] = () => Sheet();
            }

            return client;
        }

        private async Task<string> SeedReportAsync(params (string UserId, string TeamId)[] subscribers)
        {
            await using var db = _fixture.CreateFederationDbContext();
            var report = LeagueSquadStatsReport.Create(Season, PreviousSeason, "555", _group, Now);
            foreach (var (userId, teamId) in subscribers)
                report.Subscribe(userId, teamId);
            db.LeagueSquadStatsReports.Add(report);
            await db.SaveChangesAsync();
            return report.Id;
        }

        private async Task RunAsync(string reportId, FakeRffmBackgroundClient client, DateTime? now = null)
        {
            await using var db = _fixture.CreateFederationDbContext();
            var options = new RffmOptions();
            options.LeagueSquadStats.EmptySheetRetryDelayMs = 0;
            var generator = new LeagueSquadStatsGenerator(db, client, _notifications.Object,
                new FixedTimeProvider(now ?? Now.AddMinutes(10)), Options.Create(options),
                NullLogger<LeagueSquadStatsGenerator>.Instance);

            await generator.GenerateAsync(reportId, CancellationToken.None);
        }

        private async Task RefreshAsync(string reportId, FakeRffmBackgroundClient client, DateTime now)
        {
            await using (var db = _fixture.CreateFederationDbContext())
            {
                var report = await db.LeagueSquadStatsReports.SingleAsync(r => r.Id == reportId);
                report.RequestRefresh(now);
                await db.SaveChangesAsync();
            }

            client.RequestedSheets.Clear();
            await RunAsync(reportId, client, now.AddMinutes(5));
        }

        private async Task<LeagueSquadStatsReport> LoadAsync(string reportId)
        {
            await using var db = _fixture.CreateFederationDbContext();
            return await db.LeagueSquadStatsReports
                .Include(r => r.Teams).ThenInclude(t => t.Players)
                .Include(r => r.Subscribers)
                .SingleAsync(r => r.Id == reportId);
        }

        private async Task<List<RffmPlayerSeasonStats>> StatsOfAsync(string playerCode)
        {
            await using var db = _fixture.CreateFederationDbContext();
            return await db.RffmPlayerSeasonStats.Where(s => s.PlayerCode == playerCode).OrderByDescending(s => s.SeasonId).ToListAsync();
        }

        [Fact]
        public async Task La_primera_generacion_guarda_equipos_plantillas_y_las_dos_temporadas()
        {
            var reportId = await SeedReportAsync();
            var client = ClientWith(("E1", new[] { P("1"), P("2") }), ("E2", new[] { P("3") }));

            await RunAsync(reportId, client);

            var report = await LoadAsync(reportId);
            Assert.Equal(LeagueSquadStatsStatus.Completed, report.Status);
            Assert.Equal((3, 3, 0), (report.TotalPlayers, report.ProcessedPlayers, report.FailedPlayers));
            Assert.Equal(new[] { "E1", "E2" }, report.Teams.Select(t => t.TeamCode).OrderBy(c => c));
            Assert.Equal("escudo.png", report.Teams.First().ShieldUrl);
            Assert.Equal(2, report.Teams.Single(t => t.TeamCode == "E1").Players.Count);
            Assert.Equal(new[] { Season, PreviousSeason }, (await StatsOfAsync(P("1"))).Select(s => s.SeasonId));
        }

        [Fact]
        public async Task La_actualizacion_solo_pide_la_temporada_actual()
        {
            var reportId = await SeedReportAsync();
            var client = ClientWith(("E1", new[] { P("1"), P("2") }));
            await RunAsync(reportId, client);

            client.Sheets[(P("1"), Season)] = () => Sheet(called: 11, goals: 5);
            await RefreshAsync(reportId, client, Now.AddDays(7));

            Assert.All(client.RequestedSheets, request => Assert.Equal(Season, request.Season));
            Assert.Equal(2, client.RequestedSheets.Count);
            Assert.Equal((11, 5), (await StatsOfAsync(P("1"))).Select(s => (s.Called, s.Goals)).First());
        }

        [Fact]
        public async Task Un_jugador_nuevo_en_la_plantilla_pide_las_dos_temporadas()
        {
            var reportId = await SeedReportAsync();
            var client = ClientWith(("E1", new[] { P("1") }));
            await RunAsync(reportId, client);

            client.Rosters["E1"] = Roster(P("1"), P("9"));
            client.Sheets[(P("9"), Season)] = () => Sheet();
            client.Sheets[(P("9"), PreviousSeason)] = () => Sheet();
            await RefreshAsync(reportId, client, Now.AddDays(7));

            Assert.Contains((P("9"), PreviousSeason), client.RequestedSheets);
            Assert.DoesNotContain((P("1"), PreviousSeason), client.RequestedSheets);
        }

        [Fact]
        public async Task Un_jugador_que_deja_la_plantilla_desaparece_del_equipo()
        {
            var reportId = await SeedReportAsync();
            var client = ClientWith(("E1", new[] { P("1"), P("2") }));
            await RunAsync(reportId, client);

            client.Rosters["E1"] = Roster(P("1"));
            await RefreshAsync(reportId, client, Now.AddDays(7));

            var team = Assert.Single((await LoadAsync(reportId)).Teams);
            Assert.Equal(new[] { P("1") }, team.Players.Select(p => p.PlayerCode));
        }

        [Fact]
        public async Task Una_ficha_vacia_se_reintenta_una_vez()
        {
            var reportId = await SeedReportAsync();
            var client = ClientWith(("E1", new[] { P("1") }));
            var attempts = 0;
            client.Sheets[(P("1"), Season)] = () => ++attempts == 1 ? null : Sheet(called: 14);

            await RunAsync(reportId, client);

            var report = await LoadAsync(reportId);
            Assert.Equal(0, report.FailedPlayers);
            Assert.Equal(14, (await StatsOfAsync(P("1"))).First().Called);
        }

        [Fact]
        public async Task Si_la_ficha_actual_falla_se_conservan_las_estadisticas_anteriores_y_cuenta_como_fallido()
        {
            var reportId = await SeedReportAsync();
            var client = ClientWith(("E1", new[] { P("1") }));
            await RunAsync(reportId, client);

            client.Sheets[(P("1"), Season)] = () => null;
            await RefreshAsync(reportId, client, Now.AddDays(7));

            var report = await LoadAsync(reportId);
            Assert.Equal((LeagueSquadStatsStatus.Completed, 1), (report.Status, report.FailedPlayers));
            Assert.Equal(10, (await StatsOfAsync(P("1"))).First().Called);
        }

        [Fact]
        public async Task Un_error_de_red_en_una_ficha_cuenta_como_fallido_y_el_informe_continua()
        {
            var reportId = await SeedReportAsync();
            var client = ClientWith(("E1", new[] { P("1"), P("2") }));
            client.Sheets[(P("1"), Season)] = () => throw new HttpRequestException("rffm caída");

            await RunAsync(reportId, client);

            var report = await LoadAsync(reportId);
            Assert.Equal((LeagueSquadStatsStatus.Completed, 2, 1), (report.Status, report.ProcessedPlayers, report.FailedPlayers));
            Assert.NotEmpty(await StatsOfAsync(P("2")));
        }

        [Fact]
        public async Task Si_la_ficha_de_la_temporada_pasada_llega_vacia_no_se_guarda_y_se_vuelve_a_pedir()
        {
            var reportId = await SeedReportAsync();
            var client = ClientWith(("E1", new[] { P("1") }));
            client.Sheets[(P("1"), PreviousSeason)] = () => null;
            await RunAsync(reportId, client);

            await RefreshAsync(reportId, client, Now.AddDays(7));

            Assert.Equal(new[] { Season }, (await StatsOfAsync(P("1"))).Select(s => s.SeasonId));
            Assert.Contains((P("1"), PreviousSeason), client.RequestedSheets);
        }

        [Fact]
        public async Task Una_ficha_sin_actividad_en_la_temporada_pasada_se_guarda_y_no_se_vuelve_a_pedir()
        {
            var reportId = await SeedReportAsync();
            var client = ClientWith(("E1", new[] { P("1") }));
            client.Sheets[(P("1"), PreviousSeason)] = () => new Player { Name = "JUGADOR FICHA" };
            await RunAsync(reportId, client);

            await RefreshAsync(reportId, client, Now.AddDays(7));

            Assert.False((await StatsOfAsync(P("1"))).Single(s => s.SeasonId == PreviousSeason).HasActivity);
            Assert.DoesNotContain((P("1"), PreviousSeason), client.RequestedSheets);
        }

        [Fact]
        public async Task Sin_equipos_en_el_grupo_el_informe_falla_y_conserva_los_datos_anteriores()
        {
            var reportId = await SeedReportAsync();
            var client = ClientWith(("E1", new[] { P("1") }));
            await RunAsync(reportId, client);

            client.GroupTeams[_group] = new List<RffmGroupTeam>();
            await RefreshAsync(reportId, client, Now.AddDays(7));

            var report = await LoadAsync(reportId);
            Assert.Equal(LeagueSquadStatsStatus.Failed, report.Status);
            Assert.Equal("No se pudieron obtener los equipos del grupo.", report.ErrorMessage);
            Assert.Single(report.Teams);
            Assert.Equal(Now.AddMinutes(10), report.CompletedAt);
        }

        [Fact]
        public async Task Si_la_plantilla_de_un_equipo_no_responde_se_mantiene_la_anterior()
        {
            var reportId = await SeedReportAsync();
            var client = ClientWith(("E1", new[] { P("1") }), ("E2", new[] { P("2") }));
            await RunAsync(reportId, client);

            client.Rosters["E2"] = null;
            await RefreshAsync(reportId, client, Now.AddDays(7));

            var team = (await LoadAsync(reportId)).Teams.Single(t => t.TeamCode == "E2");
            Assert.Equal(new[] { P("2") }, team.Players.Select(p => p.PlayerCode));
        }

        [Fact]
        public async Task Un_jugador_en_dos_equipos_se_procesa_una_sola_vez()
        {
            var reportId = await SeedReportAsync();
            var client = ClientWith(("E1", new[] { P("1") }), ("E2", new[] { P("1") }));

            await RunAsync(reportId, client);

            Assert.Equal(1, (await LoadAsync(reportId)).TotalPlayers);
            Assert.Single(client.RequestedSheets, r => r == (P("1"), Season));
        }

        [Fact]
        public async Task Al_completar_avisa_a_los_suscriptores_de_que_esta_listo()
        {
            var reportId = await SeedReportAsync(("user-1", "team-1"), ("user-2", "team-2"));

            await RunAsync(reportId, ClientWith(("E1", new[] { P("1") })));

            var invocation = Assert.Single(_notifications.Invocations);
            var recipients = (IReadOnlyCollection<RivalStatsRecipient>)invocation.Arguments[0];
            Assert.Equal(new[] { new RivalStatsRecipient("user-1", "team-1"), new RivalStatsRecipient("user-2", "team-2") },
                recipients.OrderBy(r => r.UserId));
            Assert.True((bool)invocation.Arguments[1]);
            Assert.All((await LoadAsync(reportId)).Subscribers, s => Assert.True(s.Notified));
        }

        [Fact]
        public async Task Al_fallar_avisa_a_los_suscriptores_del_error()
        {
            var reportId = await SeedReportAsync(("user-1", "team-1"));
            var client = new FakeRffmBackgroundClient();

            await RunAsync(reportId, client);

            _notifications.Verify(n => n.DispatchRivalStatsFinishedAsync(
                It.Is<IReadOnlyCollection<RivalStatsRecipient>>(r => r.Count == 1), false, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Sin_suscriptores_no_envia_ninguna_notificacion()
        {
            var reportId = await SeedReportAsync();

            await RunAsync(reportId, ClientWith(("E1", new[] { P("1") })));

            _notifications.Verify(n => n.DispatchRivalStatsFinishedAsync(
                It.IsAny<IReadOnlyCollection<RivalStatsRecipient>>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Un_informe_que_no_esta_en_curso_no_se_procesa()
        {
            var reportId = await SeedReportAsync();
            var client = ClientWith(("E1", new[] { P("1") }));
            await RunAsync(reportId, client);
            client.RequestedGroupTeams.Clear();

            await RunAsync(reportId, client);

            Assert.Empty(client.RequestedGroupTeams);
        }
    }
}
