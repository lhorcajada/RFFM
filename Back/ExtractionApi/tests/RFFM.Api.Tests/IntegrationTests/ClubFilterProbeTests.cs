#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Probe for the data-layer club filter on real PostgreSQL. The test-only context applies the
    /// shared membership filter to Team and Player, so the translation of the membership subqueries
    /// (including the team-link branch that navigates UserTeam.Team) is proven before Step 4 registers
    /// the real filters.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class ClubFilterProbeTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public ClubFilterProbeTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private sealed class ClubFilterProbeDbContext : AppDbContext
        {
            public ClubFilterProbeDbContext(DbContextOptions<AppDbContext> options, ICurrentUserService currentUser)
                : base(options, currentUser)
            {
            }

            protected override void OnModelCreating(Microsoft.EntityFrameworkCore.ModelBuilder modelBuilder)
            {
                base.OnModelCreating(modelBuilder);
                ApplyClubScopeFilter<Team>(modelBuilder);
                ApplyClubScopeFilter<Player>(modelBuilder);
            }
        }

        private sealed record ProbeData(
            Club ClubA, Team TeamA, Player PlayerA,
            Club ClubB, Team TeamB, Player PlayerB);

        private static async Task<(Club Club, Team Team, Player Player)> SeedClubWithTeamAndPlayerAsync(AppDbContext db)
        {
            var club = Club.Create($"Probe Club {Guid.NewGuid():N}", SeededCountryId);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}",
                DateTime.UtcNow,
                DateTime.UtcNow.AddMonths(9),
                isActive: true,
                club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Probe Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "Probe",
                LastName = "Player",
                Alias = $"probe-{Guid.NewGuid():N}",
                ClubId = club.Id
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            return (club, team, player);
        }

        private async Task<ProbeData> SeedTwoClubsAsync()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (clubA, teamA, playerA) = await SeedClubWithTeamAndPlayerAsync(seedDb);
            var (clubB, teamB, playerB) = await SeedClubWithTeamAndPlayerAsync(seedDb);
            return new ProbeData(clubA, teamA, playerA, clubB, teamB, playerB);
        }

        private ClubFilterProbeDbContext CreateProbe(string? userId)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(_fixture.ConnectionString)
                .Options;
            return new ClubFilterProbeDbContext(options, new FixedCurrentUserService(userId));
        }

        [Fact]
        public async Task Club_member_sees_only_teams_and_players_of_own_club()
        {
            var data = await SeedTwoClubsAsync();
            var memberId = $"probe-member-{Guid.NewGuid():N}";
            await using (var seedDb = _fixture.CreateDbContext())
            {
                seedDb.UserClubs.Add(new UserClub(memberId, data.ClubA.Id, Membership.Coach.Id));
                await seedDb.SaveChangesAsync();
            }

            await using var probe = CreateProbe(memberId);
            var ids = new[] { data.TeamA.Id, data.TeamB.Id };
            var visibleTeams = await probe.Teams.AsNoTracking().Where(t => ids.Contains(t.Id)).Select(t => t.Id).ToListAsync();
            var playerIds = new[] { data.PlayerA.Id, data.PlayerB.Id };
            var visiblePlayers = await probe.Players.AsNoTracking().Where(p => playerIds.Contains(p.Id)).Select(p => p.Id).ToListAsync();

            Assert.Equal(new[] { data.TeamA.Id }, visibleTeams);
            Assert.Equal(new[] { data.PlayerA.Id }, visiblePlayers);
        }

        [Fact]
        public async Task User_with_only_team_link_sees_team_and_players_of_that_teams_club_and_no_other_club()
        {
            var data = await SeedTwoClubsAsync();
            var teamLinkUserId = $"probe-teamlink-{Guid.NewGuid():N}";
            await using (var seedDb = _fixture.CreateDbContext())
            {
                seedDb.UserTeams.Add(new UserTeam(teamLinkUserId, data.TeamA.Id, Membership.Player.Id));
                await seedDb.SaveChangesAsync();
            }

            await using var probe = CreateProbe(teamLinkUserId);
            var ids = new[] { data.TeamA.Id, data.TeamB.Id };
            var visibleTeams = await probe.Teams.AsNoTracking().Where(t => ids.Contains(t.Id)).Select(t => t.Id).ToListAsync();
            var playerIds = new[] { data.PlayerA.Id, data.PlayerB.Id };
            var visiblePlayers = await probe.Players.AsNoTracking().Where(p => playerIds.Contains(p.Id)).Select(p => p.Id).ToListAsync();

            Assert.Equal(new[] { data.TeamA.Id }, visibleTeams);
            Assert.Equal(new[] { data.PlayerA.Id }, visiblePlayers);
        }

        [Fact]
        public async Task User_without_any_membership_sees_no_teams_or_players_of_either_club()
        {
            var data = await SeedTwoClubsAsync();
            var outsiderId = $"probe-outsider-{Guid.NewGuid():N}";

            await using var probe = CreateProbe(outsiderId);
            var ids = new[] { data.TeamA.Id, data.TeamB.Id };
            var visibleTeams = await probe.Teams.AsNoTracking().Where(t => ids.Contains(t.Id)).Select(t => t.Id).ToListAsync();
            var playerIds = new[] { data.PlayerA.Id, data.PlayerB.Id };
            var visiblePlayers = await probe.Players.AsNoTracking().Where(p => playerIds.Contains(p.Id)).Select(p => p.Id).ToListAsync();

            Assert.Empty(visibleTeams);
            Assert.Empty(visiblePlayers);
        }

        public enum ProbeScope
        {
            ClubMember,
            TeamLink
        }

        private async Task<string> CreateUserAsync(ProbeScope scope, ProbeData data)
        {
            var userId = $"probe-{scope}-{Guid.NewGuid():N}";
            await using var seedDb = _fixture.CreateDbContext();
            if (scope == ProbeScope.ClubMember)
            {
                seedDb.UserClubs.Add(new UserClub(userId, data.ClubA.Id, Membership.Coach.Id));
            }
            else
            {
                seedDb.UserTeams.Add(new UserTeam(userId, data.TeamA.Id, Membership.Player.Id));
            }

            await seedDb.SaveChangesAsync();
            return userId;
        }

        private async Task<(string TeamPlayerA, string TeamPlayerB)> SeedTeamPlayersAsync(ProbeData data)
        {
            await using var seedDb = _fixture.CreateDbContext();
            var joined = DateTime.UtcNow.AddDays(-30);
            var teamPlayerA = TeamPlayer.Create(new TeamPlayerModel
            {
                TeamId = data.TeamA.Id,
                PlayerId = data.PlayerA.Id,
                SeasonId = data.TeamA.SeasonId,
                JoinedDate = joined,
                FamilyMembers = new()
            });
            var teamPlayerB = TeamPlayer.Create(new TeamPlayerModel
            {
                TeamId = data.TeamB.Id,
                PlayerId = data.PlayerB.Id,
                SeasonId = data.TeamB.SeasonId,
                JoinedDate = joined,
                FamilyMembers = new()
            });
            seedDb.TeamPlayers.Add(teamPlayerA);
            seedDb.TeamPlayers.Add(teamPlayerB);
            await seedDb.SaveChangesAsync();
            return (teamPlayerA.Id, teamPlayerB.Id);
        }

        [Theory]
        [InlineData(ProbeScope.ClubMember)]
        [InlineData(ProbeScope.TeamLink)]
        public async Task Two_filtered_roots_in_one_query_never_expose_other_club_data(ProbeScope scope)
        {
            var data = await SeedTwoClubsAsync();
            var userId = await CreateUserAsync(scope, data);
            var teamIds = new[] { data.TeamA.Id, data.TeamB.Id };
            var playerIds = new[] { data.PlayerA.Id, data.PlayerB.Id };

            await using var probe = CreateProbe(userId);
            var pairs = await (from t in probe.Teams
                               from p in probe.Players
                               where teamIds.Contains(t.Id) && playerIds.Contains(p.Id)
                               select new { TeamClub = t.ClubId, PlayerClub = p.ClubId })
                .AsNoTracking()
                .ToListAsync();

            Assert.Equal(new[] { new { TeamClub = data.ClubA.Id, PlayerClub = data.ClubA.Id } }, pairs);
        }

        [Theory]
        [InlineData(ProbeScope.ClubMember)]
        [InlineData(ProbeScope.TeamLink)]
        public async Task Team_query_with_correlated_player_subquery_never_exposes_other_club_players(ProbeScope scope)
        {
            var data = await SeedTwoClubsAsync();
            var userId = await CreateUserAsync(scope, data);
            var teamIds = new[] { data.TeamA.Id, data.TeamB.Id };
            var playerIds = new[] { data.PlayerA.Id, data.PlayerB.Id };

            await using var probe = CreateProbe(userId);
            var rows = await probe.Teams
                .AsNoTracking()
                .Where(t => teamIds.Contains(t.Id))
                .Select(t => new
                {
                    t.ClubId,
                    PlayerClubs = probe.Players.Where(p => playerIds.Contains(p.Id)).Select(p => p.ClubId).ToList()
                })
                .ToListAsync();

            var row = Assert.Single(rows);
            Assert.Equal(data.ClubA.Id, row.ClubId);
            Assert.Equal(new[] { data.ClubA.Id }, row.PlayerClubs);
        }

        [Theory]
        [InlineData(ProbeScope.ClubMember)]
        [InlineData(ProbeScope.TeamLink)]
        public async Task Player_query_with_correlated_team_subquery_never_exposes_other_club_teams(ProbeScope scope)
        {
            var data = await SeedTwoClubsAsync();
            var userId = await CreateUserAsync(scope, data);
            var teamIds = new[] { data.TeamA.Id, data.TeamB.Id };
            var playerIds = new[] { data.PlayerA.Id, data.PlayerB.Id };

            await using var probe = CreateProbe(userId);
            var rows = await probe.Players
                .AsNoTracking()
                .Where(p => playerIds.Contains(p.Id))
                .Select(p => new
                {
                    p.ClubId,
                    TeamClubs = probe.Teams.Where(t => teamIds.Contains(t.Id)).Select(t => t.ClubId).ToList()
                })
                .ToListAsync();

            var row = Assert.Single(rows);
            Assert.Equal(data.ClubA.Id, row.ClubId);
            Assert.Equal(new[] { data.ClubA.Id }, row.TeamClubs);
        }

        [Theory]
        [InlineData(ProbeScope.ClubMember)]
        [InlineData(ProbeScope.TeamLink)]
        public async Task Team_player_include_of_team_and_player_never_exposes_other_club(ProbeScope scope)
        {
            var data = await SeedTwoClubsAsync();
            var userId = await CreateUserAsync(scope, data);
            var (teamPlayerA, teamPlayerB) = await SeedTeamPlayersAsync(data);
            var teamPlayerIds = new[] { teamPlayerA, teamPlayerB };

            await using var probe = CreateProbe(userId);
            var links = await probe.TeamPlayers
                .AsNoTracking()
                .Include(tp => tp.Team)
                .Include(tp => tp.Player)
                .Where(tp => teamPlayerIds.Contains(tp.Id))
                .ToListAsync();

            var leaks = links
                .Where(tp => tp.Team?.ClubId == data.ClubB.Id || tp.Player?.ClubId == data.ClubB.Id)
                .Select(tp => $"TeamPlayer {tp.Id}: team club {tp.Team?.ClubId}, player club {tp.Player?.ClubId}")
                .ToList();
            Assert.Empty(leaks);
            Assert.Contains(links, tp => tp.Team?.Id == data.TeamA.Id);
        }
    }
}
