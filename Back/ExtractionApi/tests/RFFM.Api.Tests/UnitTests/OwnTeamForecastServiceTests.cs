#nullable enable
using Microsoft.Extensions.Options;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.MatchForecast.Services;
using RFFM.Api.Features.Federation.Competitions.Models;
using RFFM.Api.Features.Federation.MatchResults.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class OwnTeamForecastServiceTests
    {
        private const int Season = 22;
        private static readonly DateTime Now = new(2026, 10, 22, 8, 0, 0, DateTimeKind.Utc);

        private readonly PostgresContainerFixture _fixture;
        private readonly int _competition = Random.Shared.Next(100_000_000, 900_000_000);
        private readonly int _group = Random.Shared.Next(100_000_000, 900_000_000);
        private readonly string _prefix = Guid.NewGuid().ToString("N")[..8];

        public OwnTeamForecastServiceTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private string P(string code) => $"{_prefix}-{code}";
        private string GroupCode => _group.ToString();

        private async Task<string> SeedTeamAsync()
        {
            await using var db = _fixture.CreateDbContext();
            var club = Club.Create($"OwnForecast Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = RFFM.Api.Domain.Entities.Seasons.Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9),
                isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "OwnForecast Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id,
                RffmCompetitionId = _competition,
                RffmGroupId = _group
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

        /// <summary>
        /// Round 1 played (A 3-0 B, C 1-1 D); rounds 2 to 4 pending. Team A has three pending
        /// matches: against C (round 2), against D (round 3) and against B (round 4).
        /// </summary>
        private async Task SeedCalendarAsync()
        {
            await using var db = _fixture.CreateFederationDbContext();
            var rounds = new (int Number, RffmMatchSnapshot[] Matches)[]
            {
                (1, [Match(P("1"), "A", "B", "3", "0"), Match(P("2"), "C", "D", "1", "1")]),
                (2, [Match(P("3"), "A", "C"), Match(P("4"), "B", "D")]),
                (3, [Match(P("5"), "D", "A"), Match(P("6"), "C", "B")]),
                (4, [Match(P("7"), "A", "B"), Match(P("8"), "C", "D")])
            };
            foreach (var (number, matches) in rounds)
            {
                var round = RffmRound.Create(GroupCode, number, $"Jornada {number}", null);
                round.ApplySnapshot(matches, Now);
                db.RffmRounds.Add(round);
            }

            var group = RffmCompetitionGroup.Create(GroupCode, Season, _competition.ToString(), "Liga", "Grupo 1", null, null, null, Now);
            db.RffmCompetitionGroups.Add(group);
            await db.SaveChangesAsync();
        }

        private async Task<OwnTeamForecast?> GetForecastAsync(string teamId)
        {
            await using var appDb = _fixture.CreateDbContext();
            await using var db = _fixture.CreateFederationDbContext();
            var service = new OwnTeamForecastService(appDb, db, Options.Create(new RffmOptions()));
            return await service.GetAsync(teamId, CancellationToken.None);
        }

        [Fact]
        public async Task GetAsync_ReturnsNull_WhenTheLeagueHasNoCalendar()
        {
            var teamId = await SeedTeamAsync();

            var forecast = await GetForecastAsync(teamId);

            Assert.Null(forecast);
        }

        [Fact]
        public async Task GetAsync_ReturnsThePendingMatchesOfTheOwnTeam_WithProbabilitiesSummingToOne()
        {
            var teamId = await SeedTeamAsync();
            await SeedCalendarAsync();

            var forecast = await GetForecastAsync(teamId);

            Assert.NotNull(forecast);
            Assert.Equal(3, forecast!.PendingMatches.Count);
            Assert.Equal(new List<string> { "Equipo B", "Equipo C", "Equipo D" },
                forecast.PendingMatches.Select(m => m.Opponent).OrderBy(name => name).ToList());
            Assert.All(forecast.PendingMatches, m =>
                Assert.True(Math.Abs(m.HomeWinProbability + m.DrawProbability + m.AwayWinProbability - 1) < 0.001));
            Assert.InRange(forecast.ProjectedPosition ?? 0, 1, 4);
        }
    }
}
