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
using RFFM.Api.Domain.Entities.Federation.SquadHistory;
using RFFM.Api.Features.Federation.Players.Models;
using RFFM.Api.Features.Federation.SquadHistory.Services;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Features.Federation.Clubs.Models;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class SquadHistoryGeneratorTests
    {
        private const int Season = 22;
        private const int PreviousSeason = 21;
        private readonly PostgresContainerFixture _fixture;

        public SquadHistoryGeneratorTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private static TeamRffm Roster(params string[] playerCodes) => new()
        {
            TeamName = "CD Ejemplo A",
            Players = playerCodes.Select(c => new TeamPlayerRffm { PlayerCode = c, Name = $"JUGADOR {c}" }).ToList()
        };

        private static CompetitionParticipation Participation(string team, string group) => new()
        {
            CompetitionCode = "10", CompetitionName = "Liga", GroupCode = group, GroupName = $"Grupo {group}",
            TeamCode = team, TeamName = $"Equipo {team}", ClubName = "Club", TeamPoints = 33, TeamPosition = 4
        };

        private static Player SheetWith(params CompetitionParticipation[] participations) => new()
        {
            Matches = new MatchStatistics { Called = 20, Starter = 15, TotalGoals = 7 },
            Cards = new CardStatistics { Yellow = 3, Red = 1, DoubleYellow = 1 },
            Competitions = participations.ToList()
        };

        private static MatchRffm Acta(string localTeam, string awayTeam, params string[] localStarters) => new()
        {
            LocalTeamCode = localTeam,
            AwayTeamCode = awayTeam,
            LocalPlayers = localStarters.Select(p => new LineupPlayer { PlayerCode = p, Starter = "1" }).ToList(),
            LocalGoalsList = localStarters.Select(p => new Goal { PlayerCode = p, GoalType = "100" }).ToList()
        };

        private async Task<SquadHistoryReport> SeedReportAsync(string userId)
        {
            await using var db = _fixture.CreateFederationDbContext();
            var report = SquadHistoryReport.Create($"T{Guid.NewGuid():N}"[..20], "CD Ejemplo A", Season, PreviousSeason, userId);
            db.SquadHistoryReports.Add(report);
            await db.SaveChangesAsync();
            return report;
        }

        private async Task RunAsync(string reportId, FakeRffmBackgroundClient client)
        {
            await using var federationDb = _fixture.CreateFederationDbContext();
            await using var appDb = _fixture.CreateDbContext();
            var generator = new SquadHistoryGenerator(
                federationDb, appDb, client,
                new SquadCandidateFinder(client, NullLogger<SquadCandidateFinder>.Instance),
                Options.Create(new RffmOptions()), NullLogger<SquadHistoryGenerator>.Instance);

            await generator.GenerateAsync(reportId, CancellationToken.None);
        }

        private async Task<SquadHistoryReport> LoadAsync(string reportId)
        {
            await using var db = _fixture.CreateFederationDbContext();
            return await db.SquadHistoryReports
                .Include(r => r.Entries)
                .Include(r => r.Subscribers)
                .SingleAsync(r => r.Id == reportId);
        }

        [Fact]
        public async Task Un_solo_equipo_usa_los_totales_de_la_ficha()
        {
            var report = await SeedReportAsync("user-sheet");
            var client = new FakeRffmBackgroundClient { DefaultRoster = Roster("P1") };
            client.Sheets[("P1", Season)] = () => SheetWith(Participation("E1", "G1"));

            await RunAsync(report.Id, client);

            var stored = await LoadAsync(report.Id);
            var entry = Assert.Single(stored.Entries);
            Assert.Equal(SquadHistoryStatus.Completed, stored.Status);
            Assert.Equal(SquadHistorySource.PlayerSheet, entry.Source);
            Assert.Equal((7, 3, 2, 15, 20), (entry.Goals, entry.YellowCards, entry.RedCards, entry.Starts!.Value, entry.CallUps!.Value));
            Assert.Equal(("E1", "Club", 33, 4, "2026-2027"), (entry.TeamCode, entry.ClubName, entry.TeamPoints, entry.TeamPosition, entry.SeasonName));
        }

        [Fact]
        public async Task Varios_equipos_calcula_desde_actas_y_descarga_cada_acta_una_vez()
        {
            var report = await SeedReportAsync("user-actas");
            var client = new FakeRffmBackgroundClient { DefaultRoster = Roster("P1", "P2") };
            foreach (var player in new[] { "P1", "P2" })
                client.Sheets[(player, PreviousSeason)] = () => SheetWith(Participation("E1", "G1"), Participation("E2", "G2"));
            client.GroupMatches["G1"] = new() { new("A1", "E1", "X"), new("A2", "Y", "Z") };
            client.GroupMatches["G2"] = new() { new("B1", "E2", "X") };
            client.Actas["A1"] = Acta("E1", "X", "P1", "P2");
            client.Actas["B1"] = Acta("E2", "X", "P1");

            await RunAsync(report.Id, client);

            var stored = await LoadAsync(report.Id);
            var p1 = stored.Entries.Where(e => e.PlayerCode == "P1").OrderBy(e => e.TeamCode).ToList();
            Assert.Equal(2, p1.Count);
            Assert.All(p1, e => Assert.Equal(SquadHistorySource.Actas, e.Source));
            Assert.Equal((1, 1, 1), (p1[0].Goals, p1[0].Starts!.Value, p1[0].CallUps!.Value));
            var p2InE2 = stored.Entries.Single(e => e.PlayerCode == "P2" && e.TeamCode == "E2");
            Assert.Equal(0, p2InE2.CallUps);
            Assert.Equal(1, client.ActaCalls["A1"]);
            Assert.Equal(1, client.GroupCalls["G1"]);
            Assert.False(client.ActaCalls.ContainsKey("A2"));
        }

        [Fact]
        public async Task Jugador_con_error_de_red_queda_incompleto_y_el_informe_termina()
        {
            var report = await SeedReportAsync("user-error");
            var client = new FakeRffmBackgroundClient { DefaultRoster = Roster("P1", "P2") };
            client.Sheets[("P1", Season)] = () => throw new HttpRequestException("503");
            client.Sheets[("P2", Season)] = () => SheetWith(Participation("E1", "G1"));

            await RunAsync(report.Id, client);

            var stored = await LoadAsync(report.Id);
            Assert.Equal(SquadHistoryStatus.Completed, stored.Status);
            Assert.Equal((2, 1), (stored.ProcessedPlayers, stored.FailedPlayers));
            Assert.Contains(stored.Entries, e => e.PlayerCode == "P1" && e.IsIncomplete);
        }

        [Fact]
        public async Task Sin_plantilla_el_informe_falla_y_se_notifica()
        {
            var report = await SeedReportAsync("user-fail");
            var client = new FakeRffmBackgroundClient { DefaultRoster = null };

            await RunAsync(report.Id, client);

            var stored = await LoadAsync(report.Id);
            Assert.Equal(SquadHistoryStatus.Failed, stored.Status);
            await using var appDb = _fixture.CreateDbContext();
            var notification = await appDb.Notifications.SingleAsync(n => n.UserId == "user-fail");
            Assert.Equal("SquadHistoryFailed", notification.Type);
        }

        [Fact]
        public async Task Al_completar_notifica_una_vez_a_cada_suscriptor_con_enlace_a_la_pagina()
        {
            var report = await SeedReportAsync("user-ready");
            var client = new FakeRffmBackgroundClient { DefaultRoster = Roster("P1") };

            await RunAsync(report.Id, client);
            await RunAsync(report.Id, client);

            var stored = await LoadAsync(report.Id);
            Assert.All(stored.Subscribers, s => Assert.True(s.Notified));
            await using var appDb = _fixture.CreateDbContext();
            var notification = await appDb.Notifications.SingleAsync(n => n.UserId == "user-ready");
            Assert.Equal("SquadHistoryReady", notification.Type);
            Assert.Equal($"/federation/squad-history/{stored.TeamCode}?seasonId={Season}", notification.DeepLinkPath);
        }

        [Fact]
        public async Task Guarda_el_anio_de_nacimiento_de_la_ficha()
        {
            var report = await SeedReportAsync("user-birth");
            var client = new FakeRffmBackgroundClient { DefaultRoster = Roster("P1") };
            client.Sheets[("P1", Season)] = () =>
            {
                var sheet = SheetWith(Participation("E1", "G1"));
                sheet.BirthYear = 2011;
                return sheet;
            };

            await RunAsync(report.Id, client);

            var stored = await LoadAsync(report.Id);
            Assert.Equal(2011, Assert.Single(stored.Entries).BirthYear);
        }

        [Fact]
        public async Task Plantilla_vacia_propone_posibles_jugadores_del_club_reutilizando_su_ficha()
        {
            var report = await SeedReportAsync("user-candidates");
            var client = new FakeRffmBackgroundClient
            {
                DefaultRoster = new TeamRffm
                {
                    TeamName = "CLUB EJEMPLO 'A'", ClubCode = "1037", ClubName = "CLUB EJEMPLO", Category = "PRIMERA CADETE"
                },
                ClubTeams = () => new List<ClubTeamDirectoryItem> { new("C1", "CLUB EJEMPLO 'A'", "PRIMERA CADETE", true) }
            };
            client.Competitions.Add(new RffmCompetition("COMP", "PRIMERA CADETE", "CADETES"));
            client.Groups["COMP"] = new() { new RffmGroup("GRP", "Grupo 1") };
            client.GroupTeams["GRP"] = new() { new RffmGroupTeam("C1", "CD Ejemplo A") };
            client.TeamMatches[("GRP", "C1")] = new() { new RffmGroupMatch("ACTA-C1", "C1", "RIVAL") };
            client.Actas["ACTA-C1"] = new MatchRffm
            {
                LocalTeamCode = "C1",
                LocalPlayers = new() { new LineupPlayer { PlayerCode = "K1" }, new LineupPlayer { PlayerCode = "K2" } }
            };
            client.Sheets[("K1", PreviousSeason)] = () =>
            {
                var sheet = SheetWith(Participation("C1", "G1"));
                sheet.BirthYear = 2012;
                return sheet;
            };
            client.Sheets[("K2", PreviousSeason)] = () => new Player { BirthYear = 2009 };

            await RunAsync(report.Id, client);

            var stored = await LoadAsync(report.Id);
            Assert.Equal(SquadHistoryStatus.Completed, stored.Status);
            Assert.True(stored.IsCandidateSquad);
            var entry = Assert.Single(stored.Entries);
            Assert.Equal(("K1", 2012, "CD Ejemplo A"), (entry.PlayerCode, entry.BirthYear!.Value, entry.OriginTeamName));
            Assert.Equal(1, client.RequestedSheets.Count(s => s == ("K1", PreviousSeason)));
        }

        [Fact]
        public async Task Plantilla_vacia_con_categoria_no_soportada_termina_sin_jugadores_y_con_nota()
        {
            var report = await SeedReportAsync("user-benjamin");
            var client = new FakeRffmBackgroundClient
            {
                DefaultRoster = new TeamRffm { TeamName = "CLUB EJEMPLO BENJ", ClubCode = "1037", Category = "BENJAMIN F-7" }
            };

            await RunAsync(report.Id, client);

            var stored = await LoadAsync(report.Id);
            Assert.Equal(SquadHistoryStatus.Completed, stored.Status);
            Assert.True(stored.IsCandidateSquad);
            Assert.Empty(stored.Entries);
            Assert.NotNull(stored.CandidateSearchNote);
        }

        [Fact]
        public async Task Plantilla_vacia_con_error_inesperado_en_la_busqueda_termina_con_nota_y_sin_fallar()
        {
            var report = await SeedReportAsync("user-search-error");
            var client = new FakeRffmBackgroundClient
            {
                DefaultRoster = new TeamRffm { TeamName = "CLUB EJEMPLO 'C'", ClubCode = "1037", Category = "SEGUNDA CADETE" },
                ClubTeams = () => throw new InvalidOperationException("respuesta inesperada")
            };

            await RunAsync(report.Id, client);

            var stored = await LoadAsync(report.Id);
            Assert.Equal(SquadHistoryStatus.Completed, stored.Status);
            Assert.True(stored.IsCandidateSquad);
            Assert.Contains("InvalidOperationException", stored.CandidateSearchNote);
            await using var appDb = _fixture.CreateDbContext();
            Assert.Equal("SquadHistoryReady", (await appDb.Notifications.SingleAsync(n => n.UserId == "user-search-error")).Type);
        }

        [Fact]
        public async Task Error_inesperado_guarda_el_tipo_de_excepcion_en_el_mensaje()
        {
            var report = await SeedReportAsync("user-unexpected");
            var client = new FakeRffmBackgroundClient { DefaultRoster = Roster("P1") };
            client.Sheets[("P1", Season)] = () => throw new InvalidOperationException("boom");

            await RunAsync(report.Id, client);

            var stored = await LoadAsync(report.Id);
            Assert.Equal(SquadHistoryStatus.Failed, stored.Status);
            Assert.Contains("InvalidOperationException", stored.ErrorMessage);
        }
    }
}
