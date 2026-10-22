#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Federation.LeagueSquadStats;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.RivalStats;
using RFFM.Api.Features.Federation.Competitions.Models;
using RFFM.Api.Features.Federation.LeagueSquadStats.Services;
using RFFM.Api.Features.Federation.MatchResults.Services;
using RFFM.Api.Features.Federation.Players.Models;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class RivalSimulationTests
    {
        private const int Season = 22;
        private const int PreviousSeason = 21;
        private static readonly DateTime Now = new(2026, 10, 22, 8, 0, 0, DateTimeKind.Utc);

        private readonly PostgresContainerFixture _fixture;
        private readonly int _competition = Random.Shared.Next(100_000_000, 900_000_000);
        private readonly int _group = Random.Shared.Next(100_000_000, 900_000_000);
        private readonly string _prefix = Guid.NewGuid().ToString("N")[..8];

        public RivalSimulationTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private string P(string code) => $"{_prefix}-{code}";
        private string GroupCode => _group.ToString();

        private async Task<string> SeedTeamAsync(bool withLeague = true)
        {
            await using var db = _fixture.CreateDbContext();
            var club = Club.Create($"Simulation Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Domain.Entities.Seasons.Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9),
                isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Simulation Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id,
                RffmCompetitionId = withLeague ? _competition : null,
                RffmGroupId = withLeague ? _group : null
            });
            team.UpdateRffmTeamCode("A");
            db.Teams.Add(team);
            await db.SaveChangesAsync();
            return team.Id;
        }

        private static RffmMatchSnapshot Match(string recordCode, string local, string visitor, string localGoals = "", string visitorGoals = "") => new()
        {
            RecordCode = recordCode,
            LocalTeamCode = local,
            LocalTeamName = $"Equipo {local}",
            LocalTeamImageUrl = $"/img/{local}.png",
            VisitorTeamCode = visitor,
            VisitorTeamName = $"Equipo {visitor}",
            VisitorTeamImageUrl = $"/img/{visitor}.png",
            LocalGoals = localGoals,
            VisitorGoals = visitorGoals,
            Date = "01/11/2026"
        };

        /// <summary>A, B, C y D a una vuelta: jornada 1 jugada (A gana a B 3-0, C-D 1-1), jornadas 2 y 3 pendientes.</summary>
        private async Task SeedCalendarAsync(int sanctionPointsForB = 0)
        {
            await using var db = _fixture.CreateFederationDbContext();
            var rounds = new (int Number, RffmMatchSnapshot[] Matches)[]
            {
                (1, [Match(P("1"), "A", "B", "3", "0"), Match(P("2"), "C", "D", "1", "1")]),
                (2, [Match(P("3"), "A", "C"), Match(P("4"), "B", "D")]),
                (3, [Match(P("5"), "D", "A"), Match(P("6"), "C", "B")])
            };
            foreach (var (number, matches) in rounds)
            {
                var round = RffmRound.Create(GroupCode, number, $"Jornada {number}", null);
                round.ApplySnapshot(matches, Now);
                db.RffmRounds.Add(round);
            }

            var group = RffmCompetitionGroup.Create(GroupCode, Season, _competition.ToString(), "Liga", "Grupo 1", null, null, null, Now);
            if (sanctionPointsForB > 0)
                group.UpdateOfficialStandings(RffmMatchDayMapper.SerializeStandings(
                    [new TeamResponse { TeamId = "B", Position = "4", SanctionPoints = sanctionPointsForB.ToString() }]), 1);
            db.RffmCompetitionGroups.Add(group);
            await db.SaveChangesAsync();
        }

        private async Task SeedCompletedReportAsync()
        {
            await using var db = _fixture.CreateFederationDbContext();
            var report = LeagueSquadStatsReport.Create(Season, PreviousSeason, _competition.ToString(), GroupCode, Now.AddMinutes(-10));
            report.Start(Now.AddMinutes(-10));
            report.ReplaceSquads(new[] { "A", "B", "C", "D" }.Select(team => new LeagueSquadTeamData(team, $"Equipo {team}", null,
                [new LeagueSquadPlayerData(P(team), $"JUGADOR {team}")])));
            report.Complete(Now);
            db.LeagueSquadStatsReports.Add(report);

            var previousPositions = new Dictionary<string, int> { ["A"] = 1, ["B"] = 14, ["C"] = 7, ["D"] = 8 };
            foreach (var (team, position) in previousPositions)
            {
                var sheet = new Player
                {
                    Name = $"JUGADOR {team}",
                    Matches = new MatchStatistics { Called = 20, Played = 18, TotalGoals = 4 },
                    Competitions = [new CompetitionParticipation { CompetitionName = "PRIMERA INFANTIL", GroupName = "Grupo 1", TeamCode = "X", TeamName = "X", TeamPosition = position }]
                };
                db.RffmPlayerSeasonStats.Add(RffmPlayerSeasonStats.Create(P(team), PreviousSeason, PlayerSeasonTotalsMapper.From(sheet), Now));
            }

            await db.SaveChangesAsync();
        }

        private async Task<GetRivalSimulation.RivalSimulationResponse?> SimulateAsync(string teamId)
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var db = _fixture.CreateFederationDbContext();
            var handler = new GetRivalSimulation.Handler(appDb, db, Options.Create(new RffmOptions()));
            return await handler.Handle(new GetRivalSimulation.RivalSimulationQuery(teamId), CancellationToken.None);
        }

        [Fact]
        public async Task Devuelve_la_prediccion_de_los_pendientes_y_la_clasificacion_proyectada()
        {
            var teamId = await SeedTeamAsync();
            await SeedCalendarAsync();

            var result = await SimulateAsync(teamId);

            Assert.NotNull(result);
            Assert.Equal((2, 4, "A", 10_000), (result!.PlayedMatches, result.PendingMatches, result.OwnTeamCode, result.Iterations));
            Assert.Equal([2, 2, 3, 3], result.Matches.Select(m => m.Round));
            var first = result.Matches[0];
            Assert.Equal(("A", "Equipo A", "/img/A.png", "C"), (first.LocalTeamCode, first.LocalTeamName, first.LocalShieldUrl, first.VisitorTeamCode));
            Assert.Equal(1, first.LocalWinProbability + first.DrawProbability + first.VisitorWinProbability, 2);
            Assert.Equal(4, result.Standings.Count);
            var a = result.Standings.Single(s => s.TeamCode == "A");
            Assert.Equal((1, 3), (a.CurrentPosition, a.CurrentPoints));
            Assert.Equal(4, a.PositionProbabilities.Count);
        }

        [Fact]
        public async Task Sin_informe_de_plantillas_solo_usa_los_resultados()
        {
            var teamId = await SeedTeamAsync();
            await SeedCalendarAsync();

            var result = await SimulateAsync(teamId);

            Assert.False(result!.UsesSquadStrength);
            Assert.All(result.Standings, s => Assert.Equal(1d, s.SquadStrength));
        }

        [Fact]
        public async Task Con_informe_de_plantillas_usa_la_fuerza_de_cada_plantilla()
        {
            var teamId = await SeedTeamAsync();
            await SeedCalendarAsync();
            await SeedCompletedReportAsync();

            var result = await SimulateAsync(teamId);

            Assert.True(result!.UsesSquadStrength);
            var strength = result.Standings.ToDictionary(s => s.TeamCode, s => s.SquadStrength);
            Assert.True(strength["A"] > strength["B"]);
        }

        [Fact]
        public async Task Descuenta_los_puntos_de_sancion_oficiales()
        {
            var teamId = await SeedTeamAsync();
            await SeedCalendarAsync(sanctionPointsForB: 2);

            var result = await SimulateAsync(teamId);

            Assert.Equal(-2, result!.Standings.Single(s => s.TeamCode == "B").CurrentPoints);
        }

        [Fact]
        public async Task Sin_jornadas_guardadas_devuelve_null()
        {
            var teamId = await SeedTeamAsync();

            Assert.Null(await SimulateAsync(teamId));
        }

        [Fact]
        public async Task Un_equipo_sin_competicion_lanza_conflicto()
        {
            var teamId = await SeedTeamAsync(withLeague: false);

            await Assert.ThrowsAsync<ConflictException>(() => SimulateAsync(teamId));
        }

        [Fact]
        public async Task Un_equipo_inexistente_lanza_no_encontrado()
        {
            await Assert.ThrowsAsync<NotFoundException>(() => SimulateAsync(Guid.NewGuid().ToString()));
        }
    }
}
