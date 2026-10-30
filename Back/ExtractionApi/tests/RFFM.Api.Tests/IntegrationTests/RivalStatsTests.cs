#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Federation.LeagueSquadStats;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.RivalStats;
using RFFM.Api.Features.Federation.LeagueSquadStats.Services;
using RFFM.Api.Features.Federation.Players.Models;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class RivalStatsTests
    {
        private const int Season = 22;
        private const int PreviousSeason = 21;
        private static readonly DateTime Now = new(2026, 10, 12, 8, 0, 0, DateTimeKind.Utc);

        private readonly PostgresContainerFixture _fixture;
        private readonly RecordingQueue _queue = new();
        private readonly int _competition = Random.Shared.Next(100_000_000, 900_000_000);
        private readonly int _group = Random.Shared.Next(100_000_000, 900_000_000);
        private readonly string _prefix = Guid.NewGuid().ToString("N")[..8];

        public RivalStatsTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private sealed class RecordingQueue : ILeagueSquadStatsQueue
        {
            public List<string> Enqueued { get; } = new();

            public ValueTask EnqueueAsync(string reportId, CancellationToken cancellationToken = default)
            {
                Enqueued.Add(reportId);
                return ValueTask.CompletedTask;
            }

            public async IAsyncEnumerable<string> DequeueAllAsync(
                [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
            {
                await Task.CompletedTask;
                yield break;
            }
        }

        private string P(string code) => $"{_prefix}-{code}";

        private async Task<string> SeedTeamAsync(bool withLeague = true, string? rffmTeamCode = null)
        {
            await using var db = _fixture.CreateDbContext();
            var club = Club.Create($"Rival Stats Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Domain.Entities.Seasons.Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9),
                isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Rival Stats Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id,
                RffmCompetitionId = withLeague ? _competition : null,
                RffmGroupId = withLeague ? _group : null
            });
            team.UpdateRffmTeamCode(rffmTeamCode);
            db.Teams.Add(team);
            await db.SaveChangesAsync();
            return team.Id;
        }

        private async Task<string> SeedCompletedReportAsync(DateTime completedAt, params (string TeamCode, string[] Players)[] teams)
        {
            await using var db = _fixture.CreateFederationDbContext();
            var report = LeagueSquadStatsReport.Create(Season, PreviousSeason, _competition.ToString(), _group.ToString(), completedAt.AddMinutes(-10));
            report.Start(completedAt.AddMinutes(-10));
            report.ReplaceSquads(teams.Select(t => new LeagueSquadTeamData(t.TeamCode, $"Equipo {t.TeamCode}", "escudo.png",
                t.Players.Select(p => new LeagueSquadPlayerData(p, $"JUGADOR {p}")).ToList())));
            report.Complete(completedAt);
            db.LeagueSquadStatsReports.Add(report);
            await db.SaveChangesAsync();
            return report.Id;
        }

        private async Task SeedStatsAsync(string playerCode, int seasonId, int played, int goals = 0, bool withTeam = true)
        {
            await using var db = _fixture.CreateFederationDbContext();
            var sheet = new Player
            {
                Name = $"JUGADOR {playerCode}",
                BirthYear = 2012,
                Position = "Delantero",
                Matches = new MatchStatistics { Called = played, Played = played, TotalGoals = goals },
                Competitions = withTeam
                    ? new List<CompetitionParticipation> { new() { CompetitionName = "Liga", GroupName = "Grupo 1", TeamCode = "E1", TeamName = "Equipo E1", TeamPoints = 30, TeamPosition = 2 } }
                    : new List<CompetitionParticipation>()
            };
            db.RffmPlayerSeasonStats.Add(RffmPlayerSeasonStats.Create(playerCode, seasonId, PlayerSeasonTotalsMapper.From(sheet), Now));
            await db.SaveChangesAsync();
        }

        private async Task<RivalStatsStatusResponse> RequestAsync(string teamId, bool refresh, DateTime now, string userId = "user-1", bool backgroundEnabled = true)
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var db = _fixture.CreateFederationDbContext();
            var handler = new RequestRivalStats.Handler(appDb, db, _queue, Options.Create(new RffmOptions { BackgroundEnabled = backgroundEnabled }), new FixedTimeProvider(now));
            return await handler.Handle(new RequestRivalStats.RequestRivalStatsCommand(teamId, refresh, userId), CancellationToken.None);
        }

        private async Task<LeagueSquadStatsReport> LoadReportAsync()
        {
            await using var db = _fixture.CreateFederationDbContext();
            return await db.LeagueSquadStatsReports
                .Include(r => r.Subscribers)
                .SingleAsync(r => r.CompetitionCode == _competition.ToString() && r.GroupCode == _group.ToString());
        }

        private async Task<GetRivalStats.RivalStatsResponse?> GetAsync(string teamId, DateTime? now = null)
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var db = _fixture.CreateFederationDbContext();
            var handler = new GetRivalStats.Handler(appDb, db, Options.Create(new RffmOptions()));
            return await handler.Handle(new GetRivalStats.RivalStatsQuery(teamId), CancellationToken.None);
        }

        private async Task<GetRivalTeamStats.RivalTeamStatsResponse?> GetTeamAsync(string teamId, string teamCode)
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var db = _fixture.CreateFederationDbContext();
            var handler = new GetRivalTeamStats.Handler(appDb, db, Options.Create(new RffmOptions()));
            return await handler.Handle(new GetRivalTeamStats.RivalTeamStatsQuery(teamId, teamCode), CancellationToken.None);
        }

        [Fact]
        public async Task Solicitar_con_la_consulta_a_la_federacion_desactivada_lanza_conflicto_y_no_encola()
        {
            var teamId = await SeedTeamAsync();

            var exception = await Assert.ThrowsAsync<ConflictException>(
                () => RequestAsync(teamId, refresh: false, Now, backgroundEnabled: false));

            Assert.Equal(ErrorCodes.FederationSyncDisabled, exception.Code);
            Assert.Empty(_queue.Enqueued);
        }

        [Fact]
        public async Task Solicitar_sin_informe_lo_crea_pendiente_lo_encola_y_suscribe_al_usuario()
        {
            var teamId = await SeedTeamAsync();

            var result = await RequestAsync(teamId, refresh: false, Now);

            var report = await LoadReportAsync();
            Assert.Equal("Pending", result.Status);
            Assert.Equal((Season, PreviousSeason), (report.SeasonId, report.PreviousSeasonId!.Value));
            Assert.Equal(new[] { report.Id }, _queue.Enqueued);
            Assert.Equal(new[] { ("user-1", teamId) }, report.Subscribers.Select(s => (s.UserId, s.TeamId)));
        }

        [Fact]
        public async Task Solicitar_con_el_informe_en_curso_no_reencola_y_suscribe_al_segundo_usuario()
        {
            var teamId = await SeedTeamAsync();
            await RequestAsync(teamId, refresh: false, Now);
            _queue.Enqueued.Clear();

            var result = await RequestAsync(teamId, refresh: true, Now.AddMinutes(1), userId: "user-2");

            Assert.Equal("Pending", result.Status);
            Assert.Empty(_queue.Enqueued);
            Assert.Equal(new[] { "user-1", "user-2" }, (await LoadReportAsync()).Subscribers.Select(s => s.UserId).OrderBy(u => u));
        }

        [Fact]
        public async Task Solicitar_sin_actualizar_un_informe_completado_no_encola_nada()
        {
            var teamId = await SeedTeamAsync();
            await SeedCompletedReportAsync(Now, ("E1", new[] { P("1") }));

            var result = await RequestAsync(teamId, refresh: false, Now.AddHours(5));

            Assert.Equal("Completed", result.Status);
            Assert.Empty(_queue.Enqueued);
        }

        [Fact]
        public async Task Actualizar_pasado_el_intervalo_minimo_encola_y_suscribe()
        {
            var teamId = await SeedTeamAsync();
            var reportId = await SeedCompletedReportAsync(Now, ("E1", new[] { P("1") }));

            var result = await RequestAsync(teamId, refresh: true, Now.AddMinutes(61));

            Assert.Equal("Pending", result.Status);
            Assert.Equal(new[] { reportId }, _queue.Enqueued);
            Assert.Single((await LoadReportAsync()).Subscribers);
        }

        [Fact]
        public async Task Actualizar_antes_del_intervalo_minimo_no_encola_e_indica_cuando_se_podra()
        {
            var teamId = await SeedTeamAsync();
            await SeedCompletedReportAsync(Now, ("E1", new[] { P("1") }));

            var result = await RequestAsync(teamId, refresh: true, Now.AddMinutes(30));

            Assert.Equal("Completed", result.Status);
            Assert.Equal(Now.AddMinutes(60), result.NextRefreshAllowedAt);
            Assert.Empty(_queue.Enqueued);
            Assert.Empty((await LoadReportAsync()).Subscribers);
        }

        [Fact]
        public async Task Solicitar_para_un_equipo_sin_competicion_es_un_conflicto()
        {
            var teamId = await SeedTeamAsync(withLeague: false);

            await Assert.ThrowsAsync<ConflictException>(() => RequestAsync(teamId, refresh: false, Now));
        }

        [Fact]
        public async Task Solicitar_para_un_equipo_inexistente_no_se_encuentra()
        {
            await Assert.ThrowsAsync<NotFoundException>(() => RequestAsync("no-existe", refresh: false, Now));
        }

        [Theory]
        [InlineData("", "user-1")]
        [InlineData("team-1", "")]
        public void El_validador_exige_equipo_y_usuario(string teamId, string userId)
        {
            var result = new RequestRivalStats.Validator().Validate(new RequestRivalStats.RequestRivalStatsCommand(teamId, false, userId));

            Assert.False(result.IsValid);
        }

        [Fact]
        public async Task Consultar_sin_informe_devuelve_nulo()
        {
            var teamId = await SeedTeamAsync();

            Assert.Null(await GetAsync(teamId));
        }

        [Fact]
        public async Task Consultar_para_un_equipo_sin_competicion_es_un_conflicto()
        {
            var teamId = await SeedTeamAsync(withLeague: false);

            await Assert.ThrowsAsync<ConflictException>(() => GetAsync(teamId));
        }

        [Fact]
        public async Task Consultar_devuelve_el_estado_y_los_equipos_con_su_numero_de_jugadores()
        {
            var teamId = await SeedTeamAsync();
            await SeedCompletedReportAsync(Now, ("E1", new[] { P("1"), P("2") }), ("E2", new[] { P("3") }));

            var result = await GetAsync(teamId);

            Assert.Equal(("Completed", Now, Now.AddMinutes(60)), (result!.Status, result.CompletedAt!.Value, result.NextRefreshAllowedAt!.Value));
            Assert.Equal(new[] { ("E1", "Equipo E1", 2), ("E2", "Equipo E2", 1) },
                result.Teams.Select(t => (t.TeamCode, t.TeamName, t.PlayerCount)));
            Assert.Null(result.OwnTeamCode);
        }

        [Fact]
        public async Task Consultar_marca_el_equipo_propio_y_lo_devuelve_el_primero()
        {
            var teamId = await SeedTeamAsync(rffmTeamCode: "E2");
            await SeedCompletedReportAsync(Now, ("E1", new[] { P("1") }), ("E2", new[] { P("3") }));

            var result = await GetAsync(teamId);

            Assert.Equal("E2", result!.OwnTeamCode);
            Assert.Equal(new[] { ("E2", true), ("E1", false) }, result.Teams.Select(t => (t.TeamCode, t.IsOwnTeam)));
        }

        [Fact]
        public async Task Los_jugadores_de_un_equipo_traen_sus_temporadas_de_la_mas_reciente_a_la_mas_antigua()
        {
            var teamId = await SeedTeamAsync();
            await SeedCompletedReportAsync(Now, ("E1", new[] { P("1") }));
            await SeedStatsAsync(P("1"), Season, played: 4, goals: 2);
            await SeedStatsAsync(P("1"), PreviousSeason, played: 20, goals: 9);

            var result = await GetTeamAsync(teamId, "E1");

            var player = Assert.Single(result!.Players);
            Assert.Equal((P("1"), $"JUGADOR {P("1")}", 2012, "Delantero"), (player.PlayerCode, player.PlayerName, player.BirthYear!.Value, player.Position));
            Assert.Equal(new[] { (Season, "2026-2027", 2), (PreviousSeason, "2025-2026", 9) },
                player.Seasons.Select(s => (s.SeasonId, s.SeasonName, s.Stats.Goals)));
            Assert.Equal("Equipo E1", Assert.Single(player.Seasons[0].Teams).TeamName);
        }

        [Fact]
        public async Task Los_jugadores_se_ordenan_por_partidos_jugados_esta_temporada()
        {
            var teamId = await SeedTeamAsync();
            await SeedCompletedReportAsync(Now, ("E1", new[] { P("1"), P("2"), P("3") }));
            await SeedStatsAsync(P("1"), Season, played: 2);
            await SeedStatsAsync(P("2"), Season, played: 9);

            var result = await GetTeamAsync(teamId, "E1");

            Assert.Equal(new[] { P("2"), P("1"), P("3") }, result!.Players.Select(p => p.PlayerCode));
        }

        [Fact]
        public async Task Una_temporada_sin_actividad_no_se_muestra()
        {
            var teamId = await SeedTeamAsync();
            await SeedCompletedReportAsync(Now, ("E1", new[] { P("1") }));
            await SeedStatsAsync(P("1"), Season, played: 4);
            await SeedStatsAsync(P("1"), PreviousSeason, played: 0, withTeam: false);

            var result = await GetTeamAsync(teamId, "E1");

            Assert.Equal(new[] { Season }, Assert.Single(result!.Players).Seasons.Select(s => s.SeasonId));
        }

        [Fact]
        public async Task Un_equipo_que_no_esta_en_la_liga_devuelve_nulo()
        {
            var teamId = await SeedTeamAsync();
            await SeedCompletedReportAsync(Now, ("E1", new[] { P("1") }));

            Assert.Null(await GetTeamAsync(teamId, "OTRO"));
        }
    }
}
