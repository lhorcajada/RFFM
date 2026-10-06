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
using RFFM.Api.Features.Coaches.Users.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetMyMembershipsHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetMyMembershipsHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(Club Club, Team Team, string SeasonId)> SeedClubAndTeamAsync(AppDbContext db, string clubName, string teamName)
        {
            var club = Club.Create($"{clubName} {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = teamName,
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return (club, team, season.Id);
        }

        private static async Task<string> SeedTeamPlayerAsync(AppDbContext db, Club club, Team team, string seasonId)
        {
            var player = Player.Create(new PlayerModelBase
            {
                Name = "Lucas",
                LastName = "Pérez",
                Alias = $"lucas-{Guid.NewGuid():N}",
                ClubId = club.Id
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = team.Id,
                SeasonId = seasonId,
                JoinedDate = DateTime.UtcNow,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();
            return teamPlayer.Id;
        }

        [Fact]
        public async Task Handle_ReturnsUserClubsAndTeamsWithRoleKey()
        {
            var userId = Guid.NewGuid().ToString();
            await using var db = _fixture.CreateDbContext();
            var (club, team, _) = await SeedClubAndTeamAsync(db, "CD Ejemplo", "Infantil A");
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Directive.Id));
            db.UserTeams.Add(new UserTeam(userId, team.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var result = await new GetMyMemberships.Handler(db).Handle(new GetMyMemberships.Query(userId), CancellationToken.None);

            var clubResult = Assert.Single(result.Clubs);
            Assert.Equal(club.Id, clubResult.ClubId);
            Assert.Equal(club.Name, clubResult.ClubName);
            Assert.Equal("Directive", clubResult.Role);
            var teamResult = Assert.Single(result.Teams);
            Assert.Equal(team.Id, teamResult.TeamId);
            Assert.Equal("Infantil A", teamResult.TeamName);
            Assert.Equal(club.Id, teamResult.ClubId);
            Assert.Equal(club.Name, teamResult.ClubName);
            Assert.Equal("Coach", teamResult.Role);
            Assert.Null(teamResult.LinkedPlayerName);
        }

        [Fact]
        public async Task Handle_TeamWithLinkedPlayer_IncludesPlayerName()
        {
            var userId = Guid.NewGuid().ToString();
            await using var db = _fixture.CreateDbContext();
            var (club, team, seasonId) = await SeedClubAndTeamAsync(db, "CD Familia", "Alevín B");
            var teamPlayerId = await SeedTeamPlayerAsync(db, club, team, seasonId);
            var userTeam = new UserTeam(userId, team.Id, Membership.FamilyPlayer.Id);
            userTeam.LinkPlayer(teamPlayerId);
            db.UserTeams.Add(userTeam);
            await db.SaveChangesAsync();

            var result = await new GetMyMemberships.Handler(db).Handle(new GetMyMemberships.Query(userId), CancellationToken.None);

            var teamResult = Assert.Single(result.Teams);
            Assert.Equal("FamilyPlayer", teamResult.Role);
            Assert.Equal("Lucas Pérez", teamResult.LinkedPlayerName);
        }

        [Fact]
        public async Task Handle_ExcludesOtherUsersMemberships()
        {
            var userId = Guid.NewGuid().ToString();
            await using var db = _fixture.CreateDbContext();
            var (club, team, _) = await SeedClubAndTeamAsync(db, "CD Ajeno", "Cadete");
            db.UserClubs.Add(new UserClub(Guid.NewGuid().ToString(), club.Id, Membership.Coach.Id));
            db.UserTeams.Add(new UserTeam(Guid.NewGuid().ToString(), team.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var result = await new GetMyMemberships.Handler(db).Handle(new GetMyMemberships.Query(userId), CancellationToken.None);

            Assert.Empty(result.Clubs);
            Assert.Empty(result.Teams);
        }
    }
}
