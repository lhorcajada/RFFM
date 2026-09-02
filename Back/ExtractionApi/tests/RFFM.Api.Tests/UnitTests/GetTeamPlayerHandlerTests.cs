#nullable enable
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Players.Queries;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Coverage for GetTeamPlayer.RequestHandler's family members mapping (openspec change
    /// player-family-members-crud): once Family was promoted from an EF Core owned collection
    /// (auto-loaded with the owner) to a first-level entity, the query needed an explicit
    /// Include(tp => tp.FamilyMembers) or it would silently come back empty; this also verifies
    /// the new Id/LastName fields are surfaced. Runs against a real Postgres instance
    /// (Testcontainers) like the rest of the TeamPlayer sub-resource tests.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class GetTeamPlayerHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetTeamPlayerHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<string> CreateTeamPlayerAsync()
        {
            await using var setupDb = _fixture.CreateDbContext();

            var club = Club.Create($"GetTeamPlayer Test Club {Guid.NewGuid():N}", 1);
            setupDb.Clubs.Add(club);
            await setupDb.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}",
                DateTime.UtcNow,
                DateTime.UtcNow.AddMonths(9),
                isActive: true,
                club: club);
            setupDb.Seasons.Add(season);
            await setupDb.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "GetTeamPlayer Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            setupDb.Teams.Add(team);
            await setupDb.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test",
                LastName = "Player",
                Alias = $"testplayer-{Guid.NewGuid():N}",
                ClubId = club.Id
            });
            setupDb.Players.Add(player);
            await setupDb.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = team.Id,
                SeasonId = season.Id,
                JoinedDate = DateTime.UtcNow,
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            setupDb.TeamPlayers.Add(teamPlayer);
            await setupDb.SaveChangesAsync();

            return teamPlayer.Id;
        }

        [Fact]
        public async Task Handle_WithFamilyMembers_ReturnsThemWithIdAndLastName()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();

            await using (var seedDb = _fixture.CreateDbContext())
            {
                var familyMember = TeamPlayerFamilyMember.Create(
                    teamPlayerId, "Jane", "Doe", "600123456", "jane@rffm.test", "12345678A", "Mother");
                seedDb.TeamPlayerFamilyMembers.Add(familyMember);
                await seedDb.SaveChangesAsync();
            }

            await using var db = _fixture.CreateDbContext();
            var handler = new GetTeamPlayer.RequestHandler(db);

            var response = await handler.Handle(new GetTeamPlayer.TeamPlayerQuery { TeamPlayerId = teamPlayerId }, CancellationToken.None);

            var family = Assert.Single(response.FamilyMembers);
            Assert.False(string.IsNullOrWhiteSpace(family.Id));
            Assert.Equal("Jane", family.Name);
            Assert.Equal("Doe", family.LastName);
            Assert.Equal("Mother", family.FamilyMember);
            Assert.Equal("12345678A", family.Dni);
            Assert.Equal("None", family.RegistrationStatus);
        }

        [Fact]
        public async Task Handle_WithPendingAccountRequest_ReturnsPendingStatus()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            string familyMemberId;

            await using (var seedDb = _fixture.CreateDbContext())
            {
                var familyMember = TeamPlayerFamilyMember.Create(
                    teamPlayerId, "Jane", "Doe", "600123456", "jane@rffm.test", "12345678A", "Mother");
                seedDb.TeamPlayerFamilyMembers.Add(familyMember);
                await seedDb.SaveChangesAsync();
                familyMemberId = familyMember.Id;

                seedDb.FamilyMemberAccountRequests.Add(
                    FamilyMemberAccountRequest.Create($"user-{Guid.NewGuid():N}", familyMemberId, teamPlayerId));
                await seedDb.SaveChangesAsync();
            }

            await using var db = _fixture.CreateDbContext();
            var handler = new GetTeamPlayer.RequestHandler(db);

            var response = await handler.Handle(new GetTeamPlayer.TeamPlayerQuery { TeamPlayerId = teamPlayerId }, CancellationToken.None);

            var family = Assert.Single(response.FamilyMembers);
            Assert.Equal("Pending", family.RegistrationStatus);
        }

        [Fact]
        public async Task Handle_WithLinkedUserId_ReturnsApprovedStatus()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();

            await using (var seedDb = _fixture.CreateDbContext())
            {
                var familyMember = TeamPlayerFamilyMember.Create(
                    teamPlayerId, "Jane", "Doe", "600123456", "jane@rffm.test", "12345678A", "Mother");
                familyMember.LinkAccount($"user-{Guid.NewGuid():N}");
                seedDb.TeamPlayerFamilyMembers.Add(familyMember);
                await seedDb.SaveChangesAsync();
            }

            await using var db = _fixture.CreateDbContext();
            var handler = new GetTeamPlayer.RequestHandler(db);

            var response = await handler.Handle(new GetTeamPlayer.TeamPlayerQuery { TeamPlayerId = teamPlayerId }, CancellationToken.None);

            var family = Assert.Single(response.FamilyMembers);
            Assert.Equal("Approved", family.RegistrationStatus);
        }

        [Fact]
        public async Task Handle_WithoutFamilyMembers_ReturnsEmptyArray()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();

            await using var db = _fixture.CreateDbContext();
            var handler = new GetTeamPlayer.RequestHandler(db);

            var response = await handler.Handle(new GetTeamPlayer.TeamPlayerQuery { TeamPlayerId = teamPlayerId }, CancellationToken.None);

            Assert.Empty(response.FamilyMembers);
        }
    }
}
