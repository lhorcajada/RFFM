#nullable enable
using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.LeagueScorers;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class GetLeagueScorersHandlerTests
    {
        private static readonly DateTime Now = new(2026, 11, 2, 9, 0, 0, DateTimeKind.Utc);

        private readonly PostgresContainerFixture _fixture;
        private readonly int _competition = Random.Shared.Next(100_000_000, 900_000_000);
        private readonly int _group = Random.Shared.Next(100_000_000, 900_000_000);
        private readonly string _prefix = Guid.NewGuid().ToString("N")[..8];

        public GetLeagueScorersHandlerTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private string Code(string suffix) => $"{_prefix}-{suffix}";

        private async Task<string> SeedTeamAsync(bool withLeague = true, string? rffmTeamCode = null)
        {
            await using var db = _fixture.CreateDbContext();
            var club = Club.Create($"League Scorers Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Domain.Entities.Seasons.Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9),
                isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "League Scorers Team",
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

        private static RffmMatchSnapshot Snapshot(string recordCode, string closed, string home, string away) => new()
        {
            RecordCode = recordCode,
            RecordClosed = closed,
            Date = "01/11/2026",
            Time = "10:00",
            LocalTeamCode = $"{home}-code",
            LocalTeamName = home,
            LocalGoals = "1",
            VisitorTeamCode = $"{away}-code",
            VisitorTeamName = away,
            VisitorGoals = "0"
        };

        private async Task SeedRoundAsync(int number, params RffmMatchSnapshot[] matches)
        {
            await using var db = _fixture.CreateFederationDbContext();
            var round = RffmRound.Create(_group.ToString(), number, number.ToString(), null);
            round.ApplySnapshot(matches, Now);
            db.RffmRounds.Add(round);
            await db.SaveChangesAsync();
        }

        private async Task SeedActaAsync(string recordCode, MatchRffm acta)
        {
            await using var db = _fixture.CreateFederationDbContext();
            db.RffmMatchRecords.Add(RffmMatchRecord.Create(recordCode, _group.ToString(), JsonSerializer.Serialize(acta), Now));
            await db.SaveChangesAsync();
        }

        private async Task<LeagueScorersResponse> GetAsync(string teamId, int? round = null)
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var db = _fixture.CreateFederationDbContext();
            var handler = new GetLeagueScorers.Handler(appDb, db, Options.Create(new RffmOptions()));
            return await handler.Handle(new GetLeagueScorers.LeagueScorersQuery { TeamId = teamId, Round = round }, CancellationToken.None);
        }

        [Fact]
        public async Task Devuelve_los_goles_de_las_actas_guardadas_y_marca_las_pendientes()
        {
            var teamId = await SeedTeamAsync(rffmTeamCode: "Alameda-code");
            var withActa = Code("A");
            var withoutActa = Code("B");
            await SeedRoundAsync(1, Snapshot(withActa, "1", "Alameda", "Pinar"), Snapshot(withoutActa, "1", "Unión", "Vega"));
            await SeedActaAsync(withActa, new MatchRffm
            {
                LocalGoalsList = [new Goal { PlayerCode = "P1", PlayerName = "Hugo", Minute = "14", GoalType = "100" }]
            });

            var result = await GetAsync(teamId);

            Assert.Equal(1, result.Round);
            var stored = result.Matches.Single(m => m.RecordCode == withActa);
            Assert.Equal("Hugo", stored.Goals.Single().Player);
            Assert.True(stored.IsOwnTeam);
            Assert.True(result.Matches.Single(m => m.RecordCode == withoutActa).PendingActa);
            Assert.Equal("Hugo", result.Scorers.Single().Player);
        }

        [Fact]
        public async Task Sin_jornada_pedida_usa_la_ultima_con_partidos_cerrados()
        {
            var teamId = await SeedTeamAsync();
            await SeedRoundAsync(1, Snapshot(Code("R1"), "1", "Alameda", "Pinar"));
            await SeedRoundAsync(2, Snapshot(Code("R2"), "0", "Alameda", "Vega"));

            var result = await GetAsync(teamId);

            Assert.Equal(1, result.Round);
            Assert.Equal(new[] { 1, 2 }, result.Rounds);
        }

        [Fact]
        public async Task Un_grupo_sin_jornadas_devuelve_una_respuesta_vacia()
        {
            var teamId = await SeedTeamAsync();

            var result = await GetAsync(teamId);

            Assert.Empty(result.Rounds);
            Assert.Empty(result.Matches);
            Assert.Empty(result.Scorers);
        }

        [Fact]
        public async Task Un_equipo_sin_liga_responde_conflicto()
        {
            var teamId = await SeedTeamAsync(withLeague: false);

            await Assert.ThrowsAsync<ConflictException>(() => GetAsync(teamId));
        }
    }
}
