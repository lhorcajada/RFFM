#nullable enable
using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.RivalStats;
using RFFM.Api.Tests.Fixtures;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>Liga de cuatro equipos (A, B, C, D) con su calendario RFFM para los tests de simulación.</summary>
    internal sealed class RivalSimulationSeeder(PostgresContainerFixture fixture)
    {
        public const int Season = 22;

        public int Competition { get; } = Random.Shared.Next(100_000_000, 900_000_000);
        public int Group { get; } = Random.Shared.Next(100_000_000, 900_000_000);
        public string GroupCode => Group.ToString();
        public RivalStatsLeague League => new(Season, Competition.ToString(), GroupCode, "A");

        private readonly string _prefix = Guid.NewGuid().ToString("N")[..8];

        public async Task<string> SeedTeamAsync(bool withLeague = true)
        {
            await using var db = fixture.CreateDbContext();
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
                RffmCompetitionId = withLeague ? Competition : null,
                RffmGroupId = withLeague ? Group : null
            });
            team.UpdateRffmTeamCode("A");
            db.Teams.Add(team);
            await db.SaveChangesAsync();
            return team.Id;
        }

        public RffmMatchSnapshot Match(string code, string local, string visitor, string date, string localGoals = "", string visitorGoals = "") => new()
        {
            RecordCode = $"{_prefix}-{code}",
            LocalTeamCode = local,
            LocalTeamName = $"Equipo {local}",
            VisitorTeamCode = visitor,
            VisitorTeamName = $"Equipo {visitor}",
            LocalGoals = localGoals,
            VisitorGoals = visitorGoals,
            Date = date
        };

        /// <summary>
        /// Jornadas 1 (04/10, A 2-0 B, C 1-1 D) y 2 (11/10, C 0-1 A, D 2-0 B) jugadas;
        /// 3 (25/10: A-D, B-C) y 4 (01/11: B-A, D-C) por jugar.
        /// </summary>
        public async Task SeedCalendarAsync()
        {
            await SetRoundAsync(1, Match("1", "A", "B", "04/10/2026", "2", "0"), Match("2", "C", "D", "04/10/2026", "1", "1"));
            await SetRoundAsync(2, Match("3", "C", "A", "11/10/2026", "0", "1"), Match("4", "D", "B", "11/10/2026", "2", "0"));
            await SetRoundAsync(3, Match("5", "A", "D", "25/10/2026"), Match("6", "B", "C", "25/10/2026"));
            await SetRoundAsync(4, Match("7", "B", "A", "01/11/2026"), Match("8", "D", "C", "01/11/2026"));

            await using var db = fixture.CreateFederationDbContext();
            db.RffmCompetitionGroups.Add(RffmCompetitionGroup.Create(GroupCode, Season, Competition.ToString(), "Liga", "Grupo 1",
                null, null, null, DateTime.UtcNow));
            await db.SaveChangesAsync();
        }

        /// <summary>Crea la jornada o aplica de nuevo sus partidos (para cambiar resultados).</summary>
        public async Task SetRoundAsync(int number, params RffmMatchSnapshot[] matches)
        {
            await using var db = fixture.CreateFederationDbContext();
            var round = await db.RffmRounds.Include(r => r.Matches).SingleOrDefaultAsync(r => r.GroupCode == GroupCode && r.Number == number);
            if (round is null)
            {
                round = RffmRound.Create(GroupCode, number, $"Jornada {number}", null);
                db.RffmRounds.Add(round);
            }
            round.ApplySnapshot(matches, DateTime.UtcNow);
            await db.SaveChangesAsync();
        }

        public async Task<RffmRoundSimulation[]> LoadSimulationsAsync()
        {
            await using var db = fixture.CreateFederationDbContext();
            return (await db.RffmRoundSimulations.AsNoTracking().Where(s => s.GroupCode == GroupCode).ToListAsync())
                .OrderBy(s => s.Round)
                .ToArray();
        }
    }
}
