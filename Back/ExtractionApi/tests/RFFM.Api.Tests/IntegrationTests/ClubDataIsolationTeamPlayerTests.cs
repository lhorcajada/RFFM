#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Leak tests for the Team and Player club filter (openspec change personal-and-club-spaces, Step 4).
    /// They run the production <see cref="AppDbContext"/> on real PostgreSQL through
    /// <see cref="PostgresContainerFixture.CreateDbContext(string?)"/>: a user of one club must not read,
    /// load for modification, or bulk-update another club's Team or Player.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class ClubDataIsolationTeamPlayerTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public ClubDataIsolationTeamPlayerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private sealed record ClubSeed(
            Club Club, Team Team, Player Player);

        private sealed record IsolationData(
            ClubSeed A, ClubSeed B, ClubSeed C);

        private async Task<ClubSeed> SeedClubAsync(AppDbContext db)
        {
            var club = Club.Create($"Isolation Club {Guid.NewGuid():N}", SeededCountryId);
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
                Name = $"Isolation Team {Guid.NewGuid():N}",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "Isolation",
                LastName = "Player",
                Alias = $"isolation-{Guid.NewGuid():N}",
                ClubId = club.Id
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            return new ClubSeed(club, team, player);
        }

        private async Task<IsolationData> SeedThreeClubsAsync()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var a = await SeedClubAsync(seedDb);
            var b = await SeedClubAsync(seedDb);
            var c = await SeedClubAsync(seedDb);
            return new IsolationData(a, b, c);
        }

        private async Task<string> CreateClubMemberAsync(params Club[] clubs)
        {
            var userId = $"isolation-member-{Guid.NewGuid():N}";
            await using var seedDb = _fixture.CreateDbContext();
            foreach (var club in clubs)
            {
                seedDb.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            }

            await seedDb.SaveChangesAsync();
            return userId;
        }

        private async Task<string> CreateTeamLinkUserAsync(Team team)
        {
            var userId = $"isolation-teamlink-{Guid.NewGuid():N}";
            await using var seedDb = _fixture.CreateDbContext();
            seedDb.UserTeams.Add(new UserTeam(userId, team.Id, Membership.Player.Id));
            await seedDb.SaveChangesAsync();
            return userId;
        }

        // ---- Team ----

        [Fact]
        public async Task Team_read_by_user_of_other_club_returns_null()
        {
            var data = await SeedThreeClubsAsync();
            var userB = await CreateClubMemberAsync(data.B.Club);

            await using var db = _fixture.CreateDbContext(userB);
            var ownTeam = await db.Teams.AsNoTracking().FirstOrDefaultAsync(t => t.Id == data.B.Team.Id);
            var otherTeam = await db.Teams.AsNoTracking().FirstOrDefaultAsync(t => t.Id == data.A.Team.Id);

            Assert.NotNull(ownTeam);
            Assert.Null(otherTeam);
        }

        [Fact]
        public async Task Team_loaded_for_modification_by_user_of_other_club_returns_null()
        {
            var data = await SeedThreeClubsAsync();
            var userB = await CreateClubMemberAsync(data.B.Club);

            await using var db = _fixture.CreateDbContext(userB);
            var otherTeam = await db.Teams.FirstOrDefaultAsync(t => t.Id == data.A.Team.Id);

            Assert.Null(otherTeam);
        }

        [Fact]
        public async Task Team_bulk_update_by_user_of_other_club_affects_no_rows_and_leaves_row_unchanged()
        {
            var data = await SeedThreeClubsAsync();
            var userB = await CreateClubMemberAsync(data.B.Club);
            var originalName = data.A.Team.Name;

            await using (var db = _fixture.CreateDbContext(userB))
            {
                var affected = await db.Teams
                    .Where(t => t.Id == data.A.Team.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(t => t.Name, "Leaked by club B"));
                Assert.Equal(0, affected);
            }

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.Teams.AsNoTracking().SingleAsync(t => t.Id == data.A.Team.Id);
            Assert.Equal(originalName, stored.Name);
        }

        [Fact]
        public async Task Team_lookup_by_id_with_find_returns_null_for_user_of_other_club()
        {
            var data = await SeedThreeClubsAsync();
            var userB = await CreateClubMemberAsync(data.B.Club);

            await using var db = _fixture.CreateDbContext(userB);
            var found = await db.Teams.FindAsync(data.A.Team.Id);

            Assert.Null(found);
        }

        [Fact]
        public async Task Team_read_by_member_of_its_club_returns_the_team()
        {
            var data = await SeedThreeClubsAsync();
            var userA = await CreateClubMemberAsync(data.A.Club);

            await using var db = _fixture.CreateDbContext(userA);
            var team = await db.Teams.AsNoTracking().FirstOrDefaultAsync(t => t.Id == data.A.Team.Id);

            Assert.NotNull(team);
        }

        [Fact]
        public async Task Team_list_for_member_of_two_clubs_holds_both_clubs_and_not_the_third()
        {
            var data = await SeedThreeClubsAsync();
            var userAb = await CreateClubMemberAsync(data.A.Club, data.B.Club);
            var ids = new[] { data.A.Team.Id, data.B.Team.Id, data.C.Team.Id };

            await using var db = _fixture.CreateDbContext(userAb);
            var visible = await db.Teams.AsNoTracking().Where(t => ids.Contains(t.Id)).Select(t => t.Id).ToListAsync();

            Assert.Equal(
                new[] { data.A.Team.Id, data.B.Team.Id }.OrderBy(x => x),
                visible.OrderBy(x => x));
        }

        [Fact]
        public async Task Team_link_user_reads_team_of_its_club()
        {
            var data = await SeedThreeClubsAsync();
            var linkUser = await CreateTeamLinkUserAsync(data.A.Team);

            await using var db = _fixture.CreateDbContext(linkUser);
            var team = await db.Teams.AsNoTracking().FirstOrDefaultAsync(t => t.Id == data.A.Team.Id);

            Assert.NotNull(team);
        }

        [Fact]
        public async Task Team_link_user_does_not_read_team_of_other_club()
        {
            var data = await SeedThreeClubsAsync();
            var linkUser = await CreateTeamLinkUserAsync(data.A.Team);

            await using var db = _fixture.CreateDbContext(linkUser);
            var otherTeam = await db.Teams.AsNoTracking().FirstOrDefaultAsync(t => t.Id == data.B.Team.Id);

            Assert.Null(otherTeam);
        }

        // ---- Player ----

        [Fact]
        public async Task Player_read_by_user_of_other_club_returns_null()
        {
            var data = await SeedThreeClubsAsync();
            var userB = await CreateClubMemberAsync(data.B.Club);

            await using var db = _fixture.CreateDbContext(userB);
            var ownPlayer = await db.Players.AsNoTracking().FirstOrDefaultAsync(p => p.Id == data.B.Player.Id);
            var otherPlayer = await db.Players.AsNoTracking().FirstOrDefaultAsync(p => p.Id == data.A.Player.Id);

            Assert.NotNull(ownPlayer);
            Assert.Null(otherPlayer);
        }

        [Fact]
        public async Task Player_loaded_for_modification_by_user_of_other_club_returns_null()
        {
            var data = await SeedThreeClubsAsync();
            var userB = await CreateClubMemberAsync(data.B.Club);

            await using var db = _fixture.CreateDbContext(userB);
            var otherPlayer = await db.Players.FirstOrDefaultAsync(p => p.Id == data.A.Player.Id);

            Assert.Null(otherPlayer);
        }

        [Fact]
        public async Task Player_bulk_update_by_user_of_other_club_affects_no_rows_and_leaves_row_unchanged()
        {
            var data = await SeedThreeClubsAsync();
            var userB = await CreateClubMemberAsync(data.B.Club);
            var originalName = data.A.Player.Name;

            await using (var db = _fixture.CreateDbContext(userB))
            {
                var affected = await db.Players
                    .Where(p => p.Id == data.A.Player.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(p => p.Name, "Leaked by club B"));
                Assert.Equal(0, affected);
            }

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.Players.AsNoTracking().SingleAsync(p => p.Id == data.A.Player.Id);
            Assert.Equal(originalName, stored.Name);
        }

        [Fact]
        public async Task Player_lookup_by_id_with_find_returns_null_for_user_of_other_club()
        {
            var data = await SeedThreeClubsAsync();
            var userB = await CreateClubMemberAsync(data.B.Club);

            await using var db = _fixture.CreateDbContext(userB);
            var found = await db.Players.FindAsync(data.A.Player.Id);

            Assert.Null(found);
        }

        [Fact]
        public async Task Player_list_for_member_of_two_clubs_holds_both_clubs_and_not_the_third()
        {
            var data = await SeedThreeClubsAsync();
            var userAb = await CreateClubMemberAsync(data.A.Club, data.B.Club);
            var ids = new[] { data.A.Player.Id, data.B.Player.Id, data.C.Player.Id };

            await using var db = _fixture.CreateDbContext(userAb);
            var visible = await db.Players.AsNoTracking().Where(p => ids.Contains(p.Id)).Select(p => p.Id).ToListAsync();

            Assert.Equal(
                new[] { data.A.Player.Id, data.B.Player.Id }.OrderBy(x => x),
                visible.OrderBy(x => x));
        }

        [Fact]
        public async Task Team_link_user_reads_player_of_its_club()
        {
            var data = await SeedThreeClubsAsync();
            var linkUser = await CreateTeamLinkUserAsync(data.A.Team);

            await using var db = _fixture.CreateDbContext(linkUser);
            var player = await db.Players.AsNoTracking().FirstOrDefaultAsync(p => p.Id == data.A.Player.Id);

            Assert.NotNull(player);
        }

        [Fact]
        public async Task Team_link_user_does_not_read_player_of_other_club()
        {
            var data = await SeedThreeClubsAsync();
            var linkUser = await CreateTeamLinkUserAsync(data.A.Team);

            await using var db = _fixture.CreateDbContext(linkUser);
            var otherPlayer = await db.Players.AsNoTracking().FirstOrDefaultAsync(p => p.Id == data.B.Player.Id);

            Assert.Null(otherPlayer);
        }
    }
}
