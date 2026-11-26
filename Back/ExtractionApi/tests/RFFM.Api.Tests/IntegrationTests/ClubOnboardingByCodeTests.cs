#nullable enable
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.Teams.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Onboarding of a player or family member by team join code (openspec change
    /// personal-and-club-spaces, Step 4 "Added during implementation"). A non-member who presents the
    /// join code of a team can list that team's players and verify one of them; the verification links
    /// the user to the team through a UserTeam row, after which the user can read the team and its players.
    /// Runs the real handlers against the production user-aware context on real PostgreSQL.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class ClubOnboardingByCodeTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public ClubOnboardingByCodeTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        public enum InvalidCodeCase
        {
            NoCode,
            WrongCode,
            OtherTeamCode
        }

        private sealed record SeededTeam(Team Team, string[] TeamPlayerIds, string[] PlayerIds);

        private static Mock<UserManager<IdentityUser>> UserManagerFor(string userId)
        {
            var store = new Mock<IUserStore<IdentityUser>>();
            var mock = new Mock<UserManager<IdentityUser>>(store.Object, null!, null!, null!, null!, null!, null!, null!, null!);
            mock.Setup(m => m.FindByIdAsync(userId)).ReturnsAsync(new IdentityUser { Id = userId, UserName = userId });
            mock.Setup(m => m.IsInRoleAsync(It.IsAny<IdentityUser>(), It.IsAny<string>())).ReturnsAsync(true);
            mock.Setup(m => m.GetRolesAsync(It.IsAny<IdentityUser>())).ReturnsAsync(new List<string> { "Player" });
            return mock;
        }

        private static Mock<RoleManager<IdentityRole>> RoleManagerExisting()
        {
            var store = new Mock<IRoleStore<IdentityRole>>();
            var mock = new Mock<RoleManager<IdentityRole>>(store.Object, null!, null!, null!, null!);
            mock.Setup(m => m.RoleExistsAsync(It.IsAny<string>())).ReturnsAsync(true);
            return mock;
        }

        private static Mock<ITokenService> TokenService()
        {
            var mock = new Mock<ITokenService>();
            mock.Setup(t => t.GenerateJwtForUser(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync("jwt");
            return mock;
        }

        private async Task<SeededTeam> SeedTeamWithTwoPlayersAsync(AppDbContext db)
        {
            var club = Club.Create($"Onboarding Club {Guid.NewGuid():N}", SeededCountryId);
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
                Name = $"Onboarding Team {Guid.NewGuid():N}",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var players = new[]
            {
                Player.Create(new PlayerModelBase { Name = "Onboard", LastName = "Uno", Alias = $"ob1-{Guid.NewGuid():N}", ClubId = club.Id }),
                Player.Create(new PlayerModelBase { Name = "Onboard", LastName = "Dos", Alias = $"ob2-{Guid.NewGuid():N}", ClubId = club.Id })
            };
            db.Players.AddRange(players);
            await db.SaveChangesAsync();

            var teamPlayers = players.Select(p => TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = p.Id,
                TeamId = team.Id,
                SeasonId = season.Id,
                JoinedDate = DateTime.UtcNow.AddDays(-30),
                FamilyMembers = new()
            })).ToList();
            db.TeamPlayers.AddRange(teamPlayers);
            await db.SaveChangesAsync();

            return new SeededTeam(team, teamPlayers.Select(tp => tp.Id).ToArray(), players.Select(p => p.Id).ToArray());
        }

        private async Task<(SeededTeam Target, SeededTeam Other)> SeedTargetAndOtherTeamAsync()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var target = await SeedTeamWithTwoPlayersAsync(seedDb);
            var other = await SeedTeamWithTwoPlayersAsync(seedDb);
            return (target, other);
        }

        private async Task<string> CreateNonMemberAsync() => await Task.FromResult($"onboard-nonmember-{Guid.NewGuid():N}");

        private async Task<string> CreateClubMemberAsync(SeededTeam seeded)
        {
            var userId = $"onboard-member-{Guid.NewGuid():N}";
            await using var seedDb = _fixture.CreateDbContext();
            var clubId = (await seedDb.Teams.AsNoTracking().SingleAsync(t => t.Id == seeded.Team.Id)).ClubId;
            seedDb.UserClubs.Add(new UserClub(userId, clubId, Membership.Coach.Id));
            await seedDb.SaveChangesAsync();
            return userId;
        }

        private static string CodeFor(InvalidCodeCase invalidCase, SeededTeam other) => invalidCase switch
        {
            InvalidCodeCase.NoCode => string.Empty,
            InvalidCodeCase.WrongCode => "ZZZZZZZZ",
            _ => other.Team.JoinCode
        };

        private VerifyPlayerIdentity.Handler VerifyHandler(AppDbContext db, string userId) => new(
            db,
            UserManagerFor(userId).Object,
            RoleManagerExisting().Object,
            TokenService().Object,
            NullLogger<VerifyPlayerIdentity.Handler>.Instance);

        private static VerifyPlayerIdentity.VerifyPlayerQuery VerifyQuery(SeededTeam target, string userId, string? joinCode) =>
            new(target.Team.Id, null, null, null, target.TeamPlayerIds[0], userId, joinCode);

        [Fact]
        public async Task GetTeamPlayers_non_member_with_team_join_code_returns_only_that_teams_players()
        {
            var (target, other) = await SeedTargetAndOtherTeamAsync();
            var userId = await CreateNonMemberAsync();

            await using var db = _fixture.CreateDbContext(userId);
            var handler = new GetTeamPlayersForSelection.Handler(db);
            var response = await handler.Handle(
                new GetTeamPlayersForSelection.GetTeamPlayersQuery(target.Team.Id, target.Team.JoinCode),
                CancellationToken.None);

            Assert.NotNull(response);
            Assert.Equal(target.TeamPlayerIds.OrderBy(x => x), response!.Players.Select(p => p.Id).OrderBy(x => x));
            Assert.DoesNotContain(response.Players, p => other.TeamPlayerIds.Contains(p.Id));
        }

        [Fact]
        public async Task VerifyPlayerIdentity_non_member_with_join_code_succeeds()
        {
            var (target, _) = await SeedTargetAndOtherTeamAsync();
            var userId = await CreateNonMemberAsync();

            await using var db = _fixture.CreateDbContext(userId);
            var result = await VerifyHandler(db, userId).Handle(
                VerifyQuery(target, userId, target.Team.JoinCode), CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal(target.TeamPlayerIds[0], result!.PlayerId);
        }

        [Fact]
        public async Task VerifyPlayerIdentity_with_join_code_links_user_to_team_with_player_membership()
        {
            var (target, _) = await SeedTargetAndOtherTeamAsync();
            var userId = await CreateNonMemberAsync();

            await using (var db = _fixture.CreateDbContext(userId))
            {
                await VerifyHandler(db, userId).Handle(
                    VerifyQuery(target, userId, target.Team.JoinCode), CancellationToken.None);
            }

            await using var verifyDb = _fixture.CreateDbContext();
            var links = await verifyDb.UserTeams.AsNoTracking()
                .Where(ut => ut.ApplicationUserId == userId && ut.TeamId == target.Team.Id && ut.RoleId == Membership.Player.Id)
                .CountAsync();
            Assert.Equal(1, links);
        }

        [Fact]
        public async Task VerifyPlayerIdentity_verified_twice_with_join_code_keeps_one_user_team_row()
        {
            var (target, _) = await SeedTargetAndOtherTeamAsync();
            var userId = await CreateNonMemberAsync();

            for (var i = 0; i < 2; i++)
            {
                await using var db = _fixture.CreateDbContext(userId);
                await VerifyHandler(db, userId).Handle(
                    VerifyQuery(target, userId, target.Team.JoinCode), CancellationToken.None);
            }

            await using var verifyDb = _fixture.CreateDbContext();
            var links = await verifyDb.UserTeams.AsNoTracking().CountAsync(ut => ut.ApplicationUserId == userId && ut.TeamId == target.Team.Id);
            Assert.Equal(1, links);
        }

        [Fact]
        public async Task After_verification_with_join_code_user_reads_that_team_and_its_players()
        {
            var (target, _) = await SeedTargetAndOtherTeamAsync();
            var userId = await CreateNonMemberAsync();

            await using (var db = _fixture.CreateDbContext(userId))
            {
                await VerifyHandler(db, userId).Handle(
                    VerifyQuery(target, userId, target.Team.JoinCode), CancellationToken.None);
            }

            await using var readDb = _fixture.CreateDbContext(userId);
            var team = await readDb.Teams.AsNoTracking().FirstOrDefaultAsync(t => t.Id == target.Team.Id);
            var players = await readDb.Players.AsNoTracking().Where(p => target.PlayerIds.Contains(p.Id)).Select(p => p.Id).ToListAsync();

            Assert.NotNull(team);
            Assert.Equal(target.PlayerIds.OrderBy(x => x), players.OrderBy(x => x));
        }

        [Theory]
        [InlineData(InvalidCodeCase.NoCode)]
        [InlineData(InvalidCodeCase.WrongCode)]
        [InlineData(InvalidCodeCase.OtherTeamCode)]
        public async Task Non_member_without_valid_code_for_this_team_gets_not_found_and_writes_nothing(InvalidCodeCase invalidCase)
        {
            var (target, other) = await SeedTargetAndOtherTeamAsync();
            var userId = await CreateNonMemberAsync();
            var code = CodeFor(invalidCase, other);

            await using (var listDb = _fixture.CreateDbContext(userId))
            {
                var listed = await new GetTeamPlayersForSelection.Handler(listDb).Handle(
                    new GetTeamPlayersForSelection.GetTeamPlayersQuery(target.Team.Id, string.IsNullOrEmpty(code) ? null : code),
                    CancellationToken.None);
                Assert.Null(listed);
            }

            await using (var verifyDb = _fixture.CreateDbContext(userId))
            {
                var verified = await VerifyHandler(verifyDb, userId).Handle(
                    VerifyQuery(target, userId, string.IsNullOrEmpty(code) ? null : code), CancellationToken.None);
                Assert.Null(verified);
            }

            await using var checkDb = _fixture.CreateDbContext();
            var userTeamRows = await checkDb.UserTeams.AsNoTracking().CountAsync(ut => ut.ApplicationUserId == userId);
            var userProfileRows = await checkDb.UserProfiles.AsNoTracking().CountAsync(p => p.ApplicationUserId == userId);
            Assert.Equal(0, userTeamRows);
            Assert.Equal(0, userProfileRows);
        }

        [Fact]
        public async Task Club_member_without_code_gets_players_and_verification_as_before()
        {
            var (target, _) = await SeedTargetAndOtherTeamAsync();
            var memberId = await CreateClubMemberAsync(target);

            await using var listDb = _fixture.CreateDbContext(memberId);
            var listed = await new GetTeamPlayersForSelection.Handler(listDb).Handle(
                new GetTeamPlayersForSelection.GetTeamPlayersQuery(target.Team.Id),
                CancellationToken.None);
            Assert.NotNull(listed);
            Assert.Equal(2, listed!.Players.Count);

            await using var verifyDb = _fixture.CreateDbContext(memberId);
            var verified = await VerifyHandler(verifyDb, memberId).Handle(
                VerifyQuery(target, memberId, null), CancellationToken.None);
            Assert.NotNull(verified);
            Assert.Equal(target.TeamPlayerIds[0], verified!.PlayerId);
        }
    }
}
