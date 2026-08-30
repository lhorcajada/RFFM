#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Users.Queries;
using RFFM.Api.Features.Scopes;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetTeamUsersHandlerTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public GetTeamUsersHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static Mock<UserManager<IdentityUser>> MockUserManager()
        {
            var store = new Mock<IUserStore<IdentityUser>>();
            return new Mock<UserManager<IdentityUser>>(
                store.Object, null!, null!, null!, null!, null!, null!, null!, null!);
        }

        private static async Task SeedPaymentPlanAsync(AppDbContext db)
        {
            var existingPlan = await db.PaymentPlans.FirstOrDefaultAsync();
            if (existingPlan != null) return;

            var plan = new PaymentPlan
            {
                Name = "Test Plan",
                Description = "Test",
                PriceCents = 0,
                BillingPeriod = BillingPeriodType.Monthly,
                AllowedClubs = 0,
                AllowedTeams = 0,
                AllowedUsers = 0
            };
            db.PaymentPlans.Add(plan);
            await db.SaveChangesAsync();
        }

        private static async Task SeedSubscriptionAsync(AppDbContext db, string userId)
        {
            var plan = await db.PaymentPlans.FirstOrDefaultAsync();
            if (plan == null)
            {
                await SeedPaymentPlanAsync(db);
                plan = await db.PaymentPlans.FirstAsync();
            }

            var subscription = new Subscription
            {
                UserId = userId,
                PaymentPlanId = plan.Id,
                StartDate = DateTime.UtcNow.AddDays(-1),
                EndDate = DateTime.UtcNow.AddYears(1),
                Status = SubscriptionStatus.Active,
                CreatedAt = DateTime.UtcNow
            };
            db.Subscriptions.Add(subscription);
            await db.SaveChangesAsync();
        }

        private static async Task<Team> SeedTeamAsync(AppDbContext db, string clubName, string? creatorUserId = null)
        {
            var club = Club.Create(clubName, SeededCountryId);
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
                Name = "GetTeamUsers Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            // If creatorUserId is provided, create a CLUB-level creator (for subscription) and optionally a TEAM-level creator
            if (!string.IsNullOrEmpty(creatorUserId))
            {
                // Create club-level creator to enable subscription
                var clubCreatorLink = new UserClub(creatorUserId, club.Id, Membership.Directive.Id);
                clubCreatorLink.IsCreator = true;
                db.UserClubs.Add(clubCreatorLink);
                await db.SaveChangesAsync();

                await SeedSubscriptionAsync(db, creatorUserId);
            }

            return team;
        }

        private static async Task<Team> SeedTeamAsCreatorAsync(AppDbContext db, string clubName, string creatorUserId)
        {
            var club = Club.Create(clubName, SeededCountryId);
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
                Name = "GetTeamUsers Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            // Create TEAM-level creator
            var creatorLink = new UserTeam(creatorUserId, team.Id, Membership.Coach.Id);
            creatorLink.MarkAsCreator();
            db.UserTeams.Add(creatorLink);
            await db.SaveChangesAsync();

            await SeedSubscriptionAsync(db, creatorUserId);

            return team;
        }

        /// <summary>
        /// Test 1: Caller with no UserTeam/UserClub on the team (and none on parent club) → 403 Forbidden
        /// </summary>
        [Fact]
        public async Task CallerWithNoMembership_ReturnsForbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var creatorId = $"creator-{Guid.NewGuid():N}";
            var team = await SeedTeamAsync(db, $"Test Club {Guid.NewGuid():N}", creatorId);
            var callerId = $"caller-{Guid.NewGuid():N}";

            var scopeAuth = new ScopeAuthorizationService(db);
            var userManagerMock = MockUserManager();

            var handler = new GetTeamUsers.Handler(db, userManagerMock.Object, scopeAuth);
            var query = new GetTeamUsers.Query { CallerUserId = callerId, TeamId = team.Id };

            var result = await handler.Handle(query, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status403Forbidden, statusCodeResult.StatusCode);
        }

        /// <summary>
        /// Test 2: Unknown teamId (random guid string, no Team row) → 404 Not Found
        /// </summary>
        [Fact]
        public async Task UnknownTeamId_ReturnsNotFound()
        {
            await using var db = _fixture.CreateDbContext();
            var creatorId = $"creator-{Guid.NewGuid():N}";
            await SeedTeamAsync(db, $"Test Club {Guid.NewGuid():N}", creatorId);
            var callerId = $"caller-{Guid.NewGuid():N}";
            var unknownTeamId = Guid.NewGuid().ToString();

            var scopeAuth = new ScopeAuthorizationService(db);
            var userManagerMock = MockUserManager();

            var handler = new GetTeamUsers.Handler(db, userManagerMock.Object, scopeAuth);
            var query = new GetTeamUsers.Query { CallerUserId = callerId, TeamId = unknownTeamId };

            var result = await handler.Handle(query, CancellationToken.None);

            var statusCodeResult = Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
            Assert.Equal(StatusCodes.Status404NotFound, statusCodeResult.StatusCode);
        }

        /// <summary>
        /// Test 3: Caller with a non-creator UserTeam on the team → 200 OK with users list, callerIsCreator false
        /// </summary>
        [Fact]
        public async Task CallerNonCreator_ReturnsOkWithUsersList()
        {
            await using var db = _fixture.CreateDbContext();
            var creatorId = $"creator-{Guid.NewGuid():N}";
            var team = await SeedTeamAsync(db, $"Test Club {Guid.NewGuid():N}", creatorId);
            var callerId = $"caller-{Guid.NewGuid():N}";
            var familyPlayerId = $"family-{Guid.NewGuid():N}";
            var playerId = $"player-{Guid.NewGuid():N}";
            var coachId = $"coach-{Guid.NewGuid():N}";

            // Add caller as non-creator member
            var callerLink = new UserTeam(callerId, team.Id, Membership.ClubMember.Id);
            db.UserTeams.Add(callerLink);

            // Add family player
            var familyLink = new UserTeam(familyPlayerId, team.Id, Membership.FamilyPlayer.Id);
            db.UserTeams.Add(familyLink);

            // Add player
            var playerLink = new UserTeam(playerId, team.Id, Membership.Player.Id);
            db.UserTeams.Add(playerLink);

            // Add coach
            var coachLink = new UserTeam(coachId, team.Id, Membership.Coach.Id);
            db.UserTeams.Add(coachLink);

            await db.SaveChangesAsync();

            // Mock UserManager to return IdentityUsers for all users
            var userManagerMock = MockUserManager();
            userManagerMock.Setup(m => m.FindByIdAsync(callerId))
                .ReturnsAsync(new IdentityUser { Id = callerId, UserName = "caller", Email = "caller@test.com" });
            userManagerMock.Setup(m => m.FindByIdAsync(familyPlayerId))
                .ReturnsAsync(new IdentityUser { Id = familyPlayerId, UserName = "family", Email = "family@test.com" });
            userManagerMock.Setup(m => m.FindByIdAsync(playerId))
                .ReturnsAsync(new IdentityUser { Id = playerId, UserName = "player", Email = "player@test.com" });
            userManagerMock.Setup(m => m.FindByIdAsync(coachId))
                .ReturnsAsync(new IdentityUser { Id = coachId, UserName = "coach", Email = "coach@test.com" });

            var scopeAuth = new ScopeAuthorizationService(db);
            var handler = new GetTeamUsers.Handler(db, userManagerMock.Object, scopeAuth);
            var query = new GetTeamUsers.Query { CallerUserId = callerId, TeamId = team.Id };

            var result = await handler.Handle(query, CancellationToken.None);

            var valueResult = Assert.IsAssignableFrom<IValueHttpResult<GetTeamUsers.Response>>(result);
            var response = valueResult.Value;
            Assert.NotNull(response);
            Assert.Equal(team.Id, response.TeamId);
            Assert.False(response.CallerIsCreator);
            // 4 team-level members (caller, family, player, coach) + the club-level creator
            // seeded by SeedTeamAsync, who has no UserTeam row but must still appear (club-level
            // members always show up in every team's user list).
            Assert.Equal(5, response.Users.Count);
            Assert.Single(response.Users.Where(u => u.UserId == familyPlayerId && u.MembershipKind == "FamilyPlayer"));
            Assert.Single(response.Users.Where(u => u.UserId == playerId && u.MembershipKind == "Player"));
            Assert.Single(response.Users.Where(u => u.UserId == coachId && u.MembershipKind == "Coach"));
            Assert.Single(response.Users.Where(u => u.UserId == creatorId && u.IsCreator && u.MembershipKind == "Directive"));
        }

        /// <summary>
        /// Test 4: Caller is creator of the team → 200 OK, callerIsCreator true
        /// </summary>
        [Fact]
        public async Task CallerIsCreator_ReturnsOkWithCreatorFlag()
        {
            await using var db = _fixture.CreateDbContext();
            var callerId = $"caller-{Guid.NewGuid():N}";
            var team = await SeedTeamAsCreatorAsync(db, $"Test Club {Guid.NewGuid():N}", callerId);

            var userManagerMock = MockUserManager();
            userManagerMock.Setup(m => m.FindByIdAsync(callerId))
                .ReturnsAsync(new IdentityUser { Id = callerId, UserName = "creator", Email = "creator@test.com" });

            var scopeAuth = new ScopeAuthorizationService(db);
            var handler = new GetTeamUsers.Handler(db, userManagerMock.Object, scopeAuth);
            var query = new GetTeamUsers.Query { CallerUserId = callerId, TeamId = team.Id };

            var result = await handler.Handle(query, CancellationToken.None);

            var valueResult = Assert.IsAssignableFrom<IValueHttpResult<GetTeamUsers.Response>>(result);
            var response = valueResult.Value;
            Assert.NotNull(response);
            Assert.True(response.CallerIsCreator);
            Assert.Single(response.Users);
            Assert.True(response.Users[0].IsCreator);
        }

        /// <summary>
        /// Test 5: UserTeam on a different team is not present in response
        /// </summary>
        [Fact]
        public async Task UserOnDifferentTeam_NotInResponse()
        {
            await using var db = _fixture.CreateDbContext();
            var callerId = $"caller-{Guid.NewGuid():N}";
            var team1 = await SeedTeamAsCreatorAsync(db, $"Club 1 {Guid.NewGuid():N}", callerId);
            var team2 = await SeedTeamAsync(db, $"Club 2 {Guid.NewGuid():N}", $"creator2-{Guid.NewGuid():N}");
            var otherUserId = $"other-{Guid.NewGuid():N}";

            // Add otherUser to team2 (different team)
            var otherLink = new UserTeam(otherUserId, team2.Id, Membership.Player.Id);
            db.UserTeams.Add(otherLink);
            await db.SaveChangesAsync();

            var userManagerMock = MockUserManager();
            userManagerMock.Setup(m => m.FindByIdAsync(callerId))
                .ReturnsAsync(new IdentityUser { Id = callerId, UserName = "caller", Email = "caller@test.com" });
            userManagerMock.Setup(m => m.FindByIdAsync(otherUserId))
                .ReturnsAsync(new IdentityUser { Id = otherUserId, UserName = "other", Email = "other@test.com" });

            var scopeAuth = new ScopeAuthorizationService(db);
            var handler = new GetTeamUsers.Handler(db, userManagerMock.Object, scopeAuth);
            var query = new GetTeamUsers.Query { CallerUserId = callerId, TeamId = team1.Id };

            var result = await handler.Handle(query, CancellationToken.None);

            var valueResult = Assert.IsAssignableFrom<IValueHttpResult<GetTeamUsers.Response>>(result);
            var response = valueResult.Value;
            Assert.NotNull(response);
            Assert.Single(response.Users);
            Assert.Equal(callerId, response.Users[0].UserId);
            Assert.DoesNotContain(response.Users, u => u.UserId == otherUserId);
        }

        /// <summary>
        /// Test 6: Response includes the team's name, each user's admin-approval status
        /// (IdentityUser.EmailConfirmed), and the full name of the player a Player/FamilyPlayer
        /// account is linked to (via UserTeam.LinkedTeamPlayerId).
        /// </summary>
        [Fact]
        public async Task Response_IncludesTeamNameApprovalAndLinkedPlayerFullName()
        {
            await using var db = _fixture.CreateDbContext();
            var creatorId = $"creator-{Guid.NewGuid():N}";
            var team = await SeedTeamAsync(db, $"Test Club {Guid.NewGuid():N}", creatorId);

            var club = await db.Clubs.FirstAsync(c => c.Id == team.ClubId);
            var season = await db.Seasons.FirstAsync(s => s.ClubId == club.Id);

            var player = Player.Create(new PlayerModelBase
            {
                Name = "Hijo",
                LastName = "DePrueba",
                Alias = $"hijo-{Guid.NewGuid():N}",
                ClubId = club.Id
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = team.Id,
                SeasonId = season.Id,
                JoinedDate = DateTime.UtcNow,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            var familyId = $"family-{Guid.NewGuid():N}";
            var familyLink = new UserTeam(familyId, team.Id, Membership.FamilyPlayer.Id);
            familyLink.LinkPlayer(teamPlayer.Id);
            db.UserTeams.Add(familyLink);

            var coachId = $"coach-{Guid.NewGuid():N}";
            var coachLink = new UserTeam(coachId, team.Id, Membership.Coach.Id);
            db.UserTeams.Add(coachLink);

            await db.SaveChangesAsync();

            var userManagerMock = MockUserManager();
            userManagerMock.Setup(m => m.FindByIdAsync(creatorId))
                .ReturnsAsync(new IdentityUser { Id = creatorId, UserName = "creator", Email = "creator@test.com", EmailConfirmed = true });
            userManagerMock.Setup(m => m.FindByIdAsync(familyId))
                .ReturnsAsync(new IdentityUser { Id = familyId, UserName = "family", Email = "family@test.com", EmailConfirmed = true });
            userManagerMock.Setup(m => m.FindByIdAsync(coachId))
                .ReturnsAsync(new IdentityUser { Id = coachId, UserName = "coach", Email = "coach@test.com", EmailConfirmed = false });

            var scopeAuth = new ScopeAuthorizationService(db);
            var handler = new GetTeamUsers.Handler(db, userManagerMock.Object, scopeAuth);
            var query = new GetTeamUsers.Query { CallerUserId = creatorId, TeamId = team.Id };

            var result = await handler.Handle(query, CancellationToken.None);

            var valueResult = Assert.IsAssignableFrom<IValueHttpResult<GetTeamUsers.Response>>(result);
            var response = valueResult.Value;
            Assert.NotNull(response);
            Assert.Equal(team.Name, response.TeamName);

            var familyDto = response.Users.Single(u => u.UserId == familyId);
            Assert.True(familyDto.IsApproved);
            Assert.Equal("Hijo DePrueba", familyDto.LinkedPlayerFullName);

            var coachDto = response.Users.Single(u => u.UserId == coachId);
            Assert.False(coachDto.IsApproved);
            Assert.Null(coachDto.LinkedPlayerFullName);
        }

        /// <summary>
        /// Test 7: a coach who joined the club via club invitation code (only a club-level
        /// UserClub, no UserTeam for this specific team) must still appear in the team's user
        /// list — including for the team's own creator, not just for that club-level coach
        /// themself.
        /// </summary>
        [Fact]
        public async Task ClubLevelCoachWithoutTeamMembership_AppearsInTeamUsersList()
        {
            await using var db = _fixture.CreateDbContext();
            var creatorId = $"creator-{Guid.NewGuid():N}";
            var team = await SeedTeamAsync(db, $"Test Club {Guid.NewGuid():N}", creatorId);

            var clubLevelCoachId = $"clubcoach-{Guid.NewGuid():N}";
            var clubLevelLink = new UserClub(clubLevelCoachId, team.ClubId, Membership.Coach.Id);
            db.UserClubs.Add(clubLevelLink);
            await db.SaveChangesAsync();

            var userManagerMock = MockUserManager();
            userManagerMock.Setup(m => m.FindByIdAsync(creatorId))
                .ReturnsAsync(new IdentityUser { Id = creatorId, UserName = "creator", Email = "creator@test.com", EmailConfirmed = true });
            userManagerMock.Setup(m => m.FindByIdAsync(clubLevelCoachId))
                .ReturnsAsync(new IdentityUser { Id = clubLevelCoachId, UserName = "clubcoach", Email = "clubcoach@test.com", EmailConfirmed = true });

            var scopeAuth = new ScopeAuthorizationService(db);
            var handler = new GetTeamUsers.Handler(db, userManagerMock.Object, scopeAuth);
            var query = new GetTeamUsers.Query { CallerUserId = creatorId, TeamId = team.Id };

            var result = await handler.Handle(query, CancellationToken.None);

            var valueResult = Assert.IsAssignableFrom<IValueHttpResult<GetTeamUsers.Response>>(result);
            var response = valueResult.Value;
            Assert.NotNull(response);

            var clubCoachDto = response.Users.Single(u => u.UserId == clubLevelCoachId);
            Assert.Equal("Coach", clubCoachDto.MembershipKind);
            Assert.Equal(clubLevelLink.Id, clubCoachDto.MembershipId);
            Assert.False(clubCoachDto.IsCreator);
            Assert.False(clubCoachDto.IsSelf);
        }

        /// <summary>
        /// Test 8: the response groups users by role, and within the FamilyPlayer role orders
        /// them by their linked player's full name.
        /// </summary>
        [Fact]
        public async Task Response_OrdersByRoleThenByLinkedPlayerNameWithinFamilyPlayers()
        {
            await using var db = _fixture.CreateDbContext();
            var creatorId = $"creator-{Guid.NewGuid():N}";
            var team = await SeedTeamAsync(db, $"Test Club {Guid.NewGuid():N}", creatorId);

            var club = await db.Clubs.FirstAsync(c => c.Id == team.ClubId);
            var season = await db.Seasons.FirstAsync(s => s.ClubId == club.Id);

            var playerZeta = Player.Create(new PlayerModelBase { Name = "Zeta", LastName = "Jugador", Alias = $"zeta-{Guid.NewGuid():N}", ClubId = club.Id });
            var playerAlfa = Player.Create(new PlayerModelBase { Name = "Alfa", LastName = "Jugador", Alias = $"alfa-{Guid.NewGuid():N}", ClubId = club.Id });
            db.Players.AddRange(playerZeta, playerAlfa);
            await db.SaveChangesAsync();

            var teamPlayerZeta = TeamPlayer.Create(new TeamPlayerModel { PlayerId = playerZeta.Id, TeamId = team.Id, SeasonId = season.Id, JoinedDate = DateTime.UtcNow, FamilyMembers = new List<FamilyModel>() });
            var teamPlayerAlfa = TeamPlayer.Create(new TeamPlayerModel { PlayerId = playerAlfa.Id, TeamId = team.Id, SeasonId = season.Id, JoinedDate = DateTime.UtcNow, FamilyMembers = new List<FamilyModel>() });
            db.TeamPlayers.AddRange(teamPlayerZeta, teamPlayerAlfa);
            await db.SaveChangesAsync();

            var coachId = $"coach-{Guid.NewGuid():N}";
            db.UserTeams.Add(new UserTeam(coachId, team.Id, Membership.Coach.Id));

            var playerId = $"player-{Guid.NewGuid():N}";
            db.UserTeams.Add(new UserTeam(playerId, team.Id, Membership.Player.Id));

            var familyZetaId = $"family-zeta-{Guid.NewGuid():N}";
            var familyZetaLink = new UserTeam(familyZetaId, team.Id, Membership.FamilyPlayer.Id);
            familyZetaLink.LinkPlayer(teamPlayerZeta.Id);
            db.UserTeams.Add(familyZetaLink);

            var familyAlfaId = $"family-alfa-{Guid.NewGuid():N}";
            var familyAlfaLink = new UserTeam(familyAlfaId, team.Id, Membership.FamilyPlayer.Id);
            familyAlfaLink.LinkPlayer(teamPlayerAlfa.Id);
            db.UserTeams.Add(familyAlfaLink);

            await db.SaveChangesAsync();

            var userManagerMock = MockUserManager();
            foreach (var id in new[] { creatorId, coachId, playerId, familyZetaId, familyAlfaId })
            {
                userManagerMock.Setup(m => m.FindByIdAsync(id))
                    .ReturnsAsync(new IdentityUser { Id = id, UserName = id, Email = $"{id}@test.com", EmailConfirmed = true });
            }

            var scopeAuth = new ScopeAuthorizationService(db);
            var handler = new GetTeamUsers.Handler(db, userManagerMock.Object, scopeAuth);
            var query = new GetTeamUsers.Query { CallerUserId = creatorId, TeamId = team.Id };

            var result = await handler.Handle(query, CancellationToken.None);

            var valueResult = Assert.IsAssignableFrom<IValueHttpResult<GetTeamUsers.Response>>(result);
            var response = valueResult.Value;
            Assert.NotNull(response);

            var orderedUserIds = response.Users.Select(u => u.UserId).ToList();
            var coachIndex = orderedUserIds.IndexOf(coachId);
            var playerIndex = orderedUserIds.IndexOf(playerId);
            var familyAlfaIndex = orderedUserIds.IndexOf(familyAlfaId);
            var familyZetaIndex = orderedUserIds.IndexOf(familyZetaId);

            Assert.True(coachIndex < playerIndex, "Coach debe aparecer antes que Player");
            Assert.True(playerIndex < familyAlfaIndex, "Player debe aparecer antes que FamilyPlayer");
            Assert.True(familyAlfaIndex < familyZetaIndex, "Familiar de 'Alfa' debe aparecer antes que familiar de 'Zeta'");
        }
    }
}
