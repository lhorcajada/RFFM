#nullable enable
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Audit;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Audit;
using RFFM.Api.Features.Coaches.Seasons.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Leak tests and audit-log guards for Season and UserActivityLog (openspec change
    /// personal-and-club-spaces, Step 5). Runs the production user-aware <see cref="AppDbContext"/> on real
    /// PostgreSQL. Cross-club leak assertions must fail until the filter is registered; the audit role
    /// guards must stay green once it is.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class ClubDataIsolationSeasonActivityLogTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public ClubDataIsolationSeasonActivityLogTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private sealed record ClubSeed(Club Club, Team Team, Season Season, UserActivityLog Entry);

        private sealed record IsolationData(ClubSeed A, ClubSeed B);

        private static async Task<ClubSeed> SeedClubAsync(AppDbContext db, bool activeSeason = false)
        {
            var club = Club.Create($"S5 Club {Guid.NewGuid():N}", SeededCountryId);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}",
                DateTime.UtcNow.AddDays(-1),
                DateTime.UtcNow.AddMonths(9),
                isActive: activeSeason,
                club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = $"S5 Team {Guid.NewGuid():N}",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var entry = UserActivityLog.Create(
                $"s5-author-{Guid.NewGuid():N}", "Coach", club.Id, null, null,
                AuditEventType.PageAccess, "s5-page", "ok", null, null);
            db.UserActivityLogs.Add(entry);
            await db.SaveChangesAsync();

            return new ClubSeed(club, team, season, entry);
        }

        private async Task<IsolationData> SeedTwoClubsAsync()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var a = await SeedClubAsync(seedDb);
            var b = await SeedClubAsync(seedDb);
            return new IsolationData(a, b);
        }

        private async Task<string> CreateClubMemberAsync(params Club[] clubs)
        {
            var userId = $"s5-member-{Guid.NewGuid():N}";
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
            var userId = $"s5-teamlink-{Guid.NewGuid():N}";
            await using var seedDb = _fixture.CreateDbContext();
            seedDb.UserTeams.Add(new UserTeam(userId, team.Id, Membership.Player.Id));
            await seedDb.SaveChangesAsync();
            return userId;
        }

        private async Task<UserActivityLog> SeedClubLessEntryAsync(AppDbContext seedDb)
        {
            var entry = UserActivityLog.Create(
                $"s5-nullclub-{Guid.NewGuid():N}", "Coach", null, null, null,
                AuditEventType.PageAccess, "s5-null-page", "ok", null, null);
            seedDb.UserActivityLogs.Add(entry);
            await seedDb.SaveChangesAsync();
            return entry;
        }

        // ---- Season ----

        [Fact]
        public async Task Season_read_by_user_of_other_club_returns_null()
        {
            var data = await SeedTwoClubsAsync();
            var userB = await CreateClubMemberAsync(data.B.Club);

            await using var db = _fixture.CreateDbContext(userB);
            var own = await db.Seasons.AsNoTracking().FirstOrDefaultAsync(s => s.Id == data.B.Season.Id);
            var other = await db.Seasons.AsNoTracking().FirstOrDefaultAsync(s => s.Id == data.A.Season.Id);

            Assert.NotNull(own);
            Assert.Null(other);
        }

        [Fact]
        public async Task Season_loaded_for_modification_by_user_of_other_club_returns_null()
        {
            var data = await SeedTwoClubsAsync();
            var userB = await CreateClubMemberAsync(data.B.Club);

            await using var db = _fixture.CreateDbContext(userB);
            var other = await db.Seasons.FirstOrDefaultAsync(s => s.Id == data.A.Season.Id);

            Assert.Null(other);
        }

        [Fact]
        public async Task Season_bulk_update_by_user_of_other_club_affects_no_rows_and_leaves_row_unchanged()
        {
            var data = await SeedTwoClubsAsync();
            var userB = await CreateClubMemberAsync(data.B.Club);

            await using (var db = _fixture.CreateDbContext(userB))
            {
                var affected = await db.Seasons
                    .Where(s => s.Id == data.A.Season.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(x => x.Name, "Leaked by club B"));
                Assert.Equal(0, affected);
            }

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.Seasons.AsNoTracking().SingleAsync(s => s.Id == data.A.Season.Id);
            Assert.Equal(data.A.Season.Name, stored.Name);
        }

        [Fact]
        public async Task Season_read_by_member_of_its_club_returns_it()
        {
            var data = await SeedTwoClubsAsync();
            var userA = await CreateClubMemberAsync(data.A.Club);

            await using var db = _fixture.CreateDbContext(userA);
            var season = await db.Seasons.AsNoTracking().FirstOrDefaultAsync(s => s.Id == data.A.Season.Id);

            Assert.NotNull(season);
        }

        [Fact]
        public async Task Season_read_by_team_link_user_of_its_club_returns_it()
        {
            var data = await SeedTwoClubsAsync();
            var linkUser = await CreateTeamLinkUserAsync(data.A.Team);

            await using var db = _fixture.CreateDbContext(linkUser);
            var season = await db.Seasons.AsNoTracking().FirstOrDefaultAsync(s => s.Id == data.A.Season.Id);

            Assert.NotNull(season);
        }

        // ---- CreateSeason ----

        [Fact]
        public async Task CreateSeason_by_coach_of_club_A_keeps_club_B_active_seasons_active()
        {
            var data = await SeedTwoClubsAsync();
            await SetActiveAsync(data.B.Season.Id, true);

            var coachA = await CreateClubMemberAsync(data.A.Club);
            await RunCreateSeasonAsync(coachA, data.A.Club.Id);

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.Seasons.AsNoTracking().SingleAsync(s => s.Id == data.B.Season.Id);
            Assert.True(stored.IsActive);
        }

        [Fact]
        public async Task CreateSeason_by_coach_of_club_A_deactivates_club_A_active_seasons()
        {
            var data = await SeedTwoClubsAsync();
            await SetActiveAsync(data.A.Season.Id, true);
            var coachA = await CreateClubMemberAsync(data.A.Club);

            await RunCreateSeasonAsync(coachA, data.A.Club.Id);

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.Seasons.AsNoTracking().SingleAsync(s => s.Id == data.A.Season.Id);
            Assert.False(stored.IsActive);
        }

        private static async Task SetActiveAsync(AppDbContext db, string seasonId, bool isActive)
        {
            await db.Seasons.Where(s => s.Id == seasonId)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.IsActive, isActive));
        }

        private async Task SetActiveAsync(string seasonId, bool isActive)
        {
            await using var db = _fixture.CreateDbContext();
            await SetActiveAsync(db, seasonId, isActive);
        }

        private async Task RunCreateSeasonAsync(string userId, string clubId)
        {
            await using var db = _fixture.CreateDbContext(userId);
            var handler = new CreateSeasonHandler(db);
            await handler.Handle(
                new CreateSeasonCommand
                {
                    SeasonName = $"S5 New {Guid.NewGuid():N}",
                    StartDate = DateTime.UtcNow.AddDays(-1),
                    EndDate = DateTime.UtcNow.AddMonths(9),
                    IsActive = true,
                    ClubId = clubId
                },
                CancellationToken.None);
        }

        // ---- UserActivityLog ----

        [Fact]
        public async Task UserActivityLog_read_by_user_of_other_club_returns_null()
        {
            var data = await SeedTwoClubsAsync();
            var userB = await CreateClubMemberAsync(data.B.Club);

            await using var db = _fixture.CreateDbContext(userB);
            var own = await db.UserActivityLogs.AsNoTracking().FirstOrDefaultAsync(a => a.Id == data.B.Entry.Id);
            var other = await db.UserActivityLogs.AsNoTracking().FirstOrDefaultAsync(a => a.Id == data.A.Entry.Id);

            Assert.NotNull(own);
            Assert.Null(other);
        }

        [Fact]
        public async Task UserActivityLog_loaded_for_modification_by_user_of_other_club_returns_null()
        {
            var data = await SeedTwoClubsAsync();
            var userB = await CreateClubMemberAsync(data.B.Club);

            await using var db = _fixture.CreateDbContext(userB);
            var other = await db.UserActivityLogs.FirstOrDefaultAsync(a => a.Id == data.A.Entry.Id);

            Assert.Null(other);
        }

        [Fact]
        public async Task UserActivityLog_bulk_update_by_user_of_other_club_affects_no_rows_and_leaves_row_unchanged()
        {
            var data = await SeedTwoClubsAsync();
            var userB = await CreateClubMemberAsync(data.B.Club);

            await using (var db = _fixture.CreateDbContext(userB))
            {
                var affected = await db.UserActivityLogs
                    .Where(a => a.Id == data.A.Entry.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(x => x.Result, "tampered"));
                Assert.Equal(0, affected);
            }

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.UserActivityLogs.AsNoTracking().SingleAsync(a => a.Id == data.A.Entry.Id);
            Assert.Equal("ok", stored.Result);
        }

        [Fact]
        public async Task UserActivityLog_read_by_member_of_its_club_returns_it()
        {
            var data = await SeedTwoClubsAsync();
            var userA = await CreateClubMemberAsync(data.A.Club);

            await using var db = _fixture.CreateDbContext(userA);
            var entry = await db.UserActivityLogs.AsNoTracking().FirstOrDefaultAsync(a => a.Id == data.A.Entry.Id);

            Assert.NotNull(entry);
        }

        [Fact]
        public async Task UserActivityLog_read_by_team_link_user_of_its_club_returns_it()
        {
            var data = await SeedTwoClubsAsync();
            var linkUser = await CreateTeamLinkUserAsync(data.A.Team);

            await using var db = _fixture.CreateDbContext(linkUser);
            var entry = await db.UserActivityLogs.AsNoTracking().FirstOrDefaultAsync(a => a.Id == data.A.Entry.Id);

            Assert.NotNull(entry);
        }

        [Fact]
        public async Task Club_less_entry_is_returned_to_any_authenticated_user()
        {
            var data = await SeedTwoClubsAsync();
            await using var seedDb = _fixture.CreateDbContext();
            var clubLess = await SeedClubLessEntryAsync(seedDb);
            var userA = await CreateClubMemberAsync(data.A.Club);

            await using var db = _fixture.CreateDbContext(userA);
            var found = await db.UserActivityLogs.AsNoTracking().FirstOrDefaultAsync(a => a.Id == clubLess.Id);

            Assert.NotNull(found);
        }

        [Fact]
        public async Task Club_less_entry_is_modifiable_by_any_authenticated_user()
        {
            var data = await SeedTwoClubsAsync();
            await using var seedDb = _fixture.CreateDbContext();
            var clubLess = await SeedClubLessEntryAsync(seedDb);
            var userA = await CreateClubMemberAsync(data.A.Club);

            await using var db = _fixture.CreateDbContext(userA);
            var affected = await db.UserActivityLogs
                .Where(a => a.Id == clubLess.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.Result, "updated"));

            Assert.Equal(1, affected);
        }

        // ---- Audit-log role guards (must stay green once the filter is registered) ----

        private static Mock<ICurrentUserService> CurrentUser(string userId, params string[] roles)
        {
            var mock = new Mock<ICurrentUserService>();
            mock.Setup(c => c.UserId).Returns(userId);
            mock.Setup(c => c.Roles).Returns(roles);
            mock.Setup(c => c.IsAuthenticated).Returns(true);
            return mock;
        }

        private static Mock<UserManager<IdentityUser>> UserManagerMock()
        {
            var store = new Mock<IUserStore<IdentityUser>>();
            var mock = new Mock<UserManager<IdentityUser>>(store.Object, null!, null!, null!, null!, null!, null!, null!, null!);
            mock.Setup(m => m.FindByIdAsync(It.IsAny<string>()))
                .ReturnsAsync((string id) => new IdentityUser { Id = id, UserName = id });
            mock.Setup(m => m.GetRolesAsync(It.IsAny<IdentityUser>())).ReturnsAsync(new List<string>());
            return mock;
        }

        [Theory]
        [InlineData("Federation")]
        [InlineData("Administrator")]
        public async Task Audit_search_by_federation_or_administrator_sees_entries_of_every_club(string role)
        {
            var data = await SeedTwoClubsAsync();
            var callerId = $"s5-{role}-{Guid.NewGuid():N}";

            await using var db = _fixture.CreateDbContext(callerId);
            var handler = new SearchAuditLog.SearchAuditLogHandler(db, CurrentUser(callerId, role).Object, UserManagerMock().Object);
            var (items, _) = await handler.Handle(
                new SearchAuditLog.SearchAuditLogQuery(PageNumber: 1, PageSize: 100), CancellationToken.None);

            var ids = items.Select(i => i.Id).ToArray();
            Assert.Contains(data.A.Entry.Id, ids);
            Assert.Contains(data.B.Entry.Id, ids);
        }

        [Fact]
        public async Task Audit_search_by_club_director_sees_only_entries_of_own_clubs()
        {
            var data = await SeedTwoClubsAsync();
            var directorId = await CreateClubMemberAsync(data.A.Club);

            await using var db = _fixture.CreateDbContext(directorId);
            var handler = new SearchAuditLog.SearchAuditLogHandler(db, CurrentUser(directorId, "ClubDirector").Object, UserManagerMock().Object);
            var (items, _) = await handler.Handle(
                new SearchAuditLog.SearchAuditLogQuery(PageNumber: 1, PageSize: 100), CancellationToken.None);

            var ids = items.Select(i => i.Id).ToArray();
            Assert.Contains(data.A.Entry.Id, ids);
            Assert.DoesNotContain(data.B.Entry.Id, ids);
        }

        [Theory]
        [InlineData("Federation")]
        [InlineData("Administrator")]
        public async Task Audit_bulk_delete_by_federation_or_administrator_removes_entries_of_every_club(string role)
        {
            var data = await SeedTwoClubsAsync();
            var callerId = $"s5-{role}-{Guid.NewGuid():N}";

            await using var db = _fixture.CreateDbContext(callerId);
            var handler = new DeleteAuditLogEntries.Handler(db);
            var response = await handler.Handle(
                new DeleteAuditLogEntries.DeleteAuditLogEntriesCommand(new[] { data.A.Entry.Id, data.B.Entry.Id }),
                CancellationToken.None);

            Assert.Equal(2, response.Deleted);
        }
    }
}
