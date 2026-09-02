#nullable enable
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Infrastructure.Migrations;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Coverage for the BackfillFamilyMemberLinkedUserId data migration
    /// (openspec change family-member-coach-registration): before the newer
    /// Register/Approve family-member-account flow existed, a family member could already
    /// self-register through the older generic CreateUser.Handler IsFamilyMember branch using
    /// the player's PlayerLinkCode — that flow creates a UserTeam (RoleId =
    /// Membership.FamilyPlayer.Id) linked to the TeamPlayer but never set
    /// TeamPlayerFamilyMember.LinkedUserId, so GetTeamPlayer's RegistrationStatus mapping
    /// wrongly reported those family members as "None" even though they have a working account.
    ///
    /// These tests execute the migration's exact backfill SQL (BackfillFamilyMemberLinkedUserId
    /// .BackfillSql) against data shaped the way it was left by the old flow, rather than relying
    /// on whatever happened to exist when PostgresContainerFixture ran migrations at container
    /// startup (before any test data existed).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class BackfillFamilyMemberLinkedUserIdTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public BackfillFamilyMemberLinkedUserIdTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string TeamPlayerId, string FamilyMemberId)> CreateTeamPlayerWithFamilyMemberAsync(
            string? familyMemberEmail, string? linkedUserId = null)
        {
            await using var db = _fixture.CreateDbContext();

            var club = Club.Create($"Backfill Test Club {Guid.NewGuid():N}", SeededCountryId);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9),
                isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Backfill Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test",
                LastName = "Player",
                Alias = $"backfill-player-{Guid.NewGuid():N}",
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
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            var familyMember = TeamPlayerFamilyMember.Create(
                teamPlayer.Id, "Jane", "Doe", "600123456", familyMemberEmail, "12345678A", "Mother");
            db.TeamPlayerFamilyMembers.Add(familyMember);
            await db.SaveChangesAsync();

            if (linkedUserId is not null)
            {
                familyMember.LinkAccount(linkedUserId);
                await db.SaveChangesAsync();
            }

            return (teamPlayer.Id, familyMember.Id);
        }

        private async Task<string> CreateIdentityUserAsync(string email)
        {
            await using var identityDb = _fixture.CreateIdentityDbContext();

            var user = new IdentityUser
            {
                Id = $"backfill-user-{Guid.NewGuid():N}",
                UserName = $"backfilluser-{Guid.NewGuid():N}",
                Email = email,
                NormalizedEmail = email.ToUpperInvariant(),
                NormalizedUserName = $"BACKFILLUSER-{Guid.NewGuid():N}"
            };
            identityDb.Users.Add(user);
            await identityDb.SaveChangesAsync();

            return user.Id;
        }

        private async Task CreateFamilyPlayerUserTeamAsync(string userId, string teamId, string teamPlayerId)
        {
            await using var db = _fixture.CreateDbContext();

            var userTeam = new UserTeam(userId, teamId, Membership.FamilyPlayer.Id);
            userTeam.LinkPlayer(teamPlayerId);
            db.UserTeams.Add(userTeam);
            await db.SaveChangesAsync();
        }

        private async Task RunBackfillAsync()
        {
            await using var db = _fixture.CreateDbContext();
            await db.Database.ExecuteSqlRawAsync(BackfillFamilyMemberLinkedUserId.BackfillSql);
        }

        [Fact]
        public async Task Backfill_SetsLinkedUserId_ForFamilyMemberRegisteredThroughOldSelfRegisterFlow()
        {
            var email = $"jane-{Guid.NewGuid():N}@rffm.test";
            var (teamPlayerId, familyMemberId) = await CreateTeamPlayerWithFamilyMemberAsync(email);

            await using var teamDb = _fixture.CreateDbContext();
            var teamPlayer = await teamDb.TeamPlayers.SingleAsync(tp => tp.Id == teamPlayerId);
            var identityUserId = await CreateIdentityUserAsync(email.ToUpperInvariant()); // case-insensitive match
            await CreateFamilyPlayerUserTeamAsync(identityUserId, teamPlayer.TeamId, teamPlayerId);

            await RunBackfillAsync();

            await using var verifyDb = _fixture.CreateDbContext();
            var storedFamilyMember = await verifyDb.TeamPlayerFamilyMembers.SingleAsync(f => f.Id == familyMemberId);
            Assert.Equal(identityUserId, storedFamilyMember.LinkedUserId);
        }

        [Fact]
        public async Task Backfill_IsIdempotent_WhenRunTwice()
        {
            var email = $"jane-{Guid.NewGuid():N}@rffm.test";
            var (teamPlayerId, familyMemberId) = await CreateTeamPlayerWithFamilyMemberAsync(email);

            await using var teamDb = _fixture.CreateDbContext();
            var teamPlayer = await teamDb.TeamPlayers.SingleAsync(tp => tp.Id == teamPlayerId);
            var identityUserId = await CreateIdentityUserAsync(email);
            await CreateFamilyPlayerUserTeamAsync(identityUserId, teamPlayer.TeamId, teamPlayerId);

            await RunBackfillAsync();
            await RunBackfillAsync(); // re-run: must not throw, duplicate, or change the result

            await using var verifyDb = _fixture.CreateDbContext();
            var storedFamilyMember = await verifyDb.TeamPlayerFamilyMembers.SingleAsync(f => f.Id == familyMemberId);
            Assert.Equal(identityUserId, storedFamilyMember.LinkedUserId);
        }

        [Fact]
        public async Task Backfill_DoesNotTouch_FamilyMemberWithoutAnyMatchingAccount()
        {
            var email = $"nomatch-{Guid.NewGuid():N}@rffm.test";
            var (_, familyMemberId) = await CreateTeamPlayerWithFamilyMemberAsync(email);

            await RunBackfillAsync();

            await using var verifyDb = _fixture.CreateDbContext();
            var storedFamilyMember = await verifyDb.TeamPlayerFamilyMembers.SingleAsync(f => f.Id == familyMemberId);
            Assert.Null(storedFamilyMember.LinkedUserId);
        }

        [Fact]
        public async Task Backfill_DoesNotOverwrite_AlreadyLinkedFamilyMember()
        {
            var email = $"jane-{Guid.NewGuid():N}@rffm.test";
            const string existingLinkedUserId = "already-linked-via-new-flow";
            var (teamPlayerId, familyMemberId) = await CreateTeamPlayerWithFamilyMemberAsync(email, existingLinkedUserId);

            await using var teamDb = _fixture.CreateDbContext();
            var teamPlayer = await teamDb.TeamPlayers.SingleAsync(tp => tp.Id == teamPlayerId);
            var otherUserId = await CreateIdentityUserAsync(email);
            await CreateFamilyPlayerUserTeamAsync(otherUserId, teamPlayer.TeamId, teamPlayerId);

            await RunBackfillAsync();

            await using var verifyDb = _fixture.CreateDbContext();
            var storedFamilyMember = await verifyDb.TeamPlayerFamilyMembers.SingleAsync(f => f.Id == familyMemberId);
            Assert.Equal(existingLinkedUserId, storedFamilyMember.LinkedUserId);
        }

        [Fact]
        public async Task Backfill_DoesNotMatch_EmailFromADifferentTeamPlayer()
        {
            var sharedEmail = $"shared-{Guid.NewGuid():N}@rffm.test";
            var (_, familyMemberId) = await CreateTeamPlayerWithFamilyMemberAsync(sharedEmail);

            // A UserTeam/IdentityUser with the same email but linked to an unrelated TeamPlayer
            // must not be matched.
            var (otherTeamPlayerId, _) = await CreateTeamPlayerWithFamilyMemberAsync(null);
            await using var teamDb = _fixture.CreateDbContext();
            var otherTeamPlayer = await teamDb.TeamPlayers.SingleAsync(tp => tp.Id == otherTeamPlayerId);
            var identityUserId = await CreateIdentityUserAsync(sharedEmail);
            await CreateFamilyPlayerUserTeamAsync(identityUserId, otherTeamPlayer.TeamId, otherTeamPlayerId);

            await RunBackfillAsync();

            await using var verifyDb = _fixture.CreateDbContext();
            var storedFamilyMember = await verifyDb.TeamPlayerFamilyMembers.SingleAsync(f => f.Id == familyMemberId);
            Assert.Null(storedFamilyMember.LinkedUserId);
        }
    }
}
