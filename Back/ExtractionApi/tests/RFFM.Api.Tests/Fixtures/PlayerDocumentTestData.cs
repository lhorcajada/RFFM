#nullable enable
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Infrastructure.Persistence;
using System.Linq;

namespace RFFM.Api.Tests.Fixtures
{
    /// <summary>
    /// PlayerDocuments/UserTeams both have real foreign keys to Teams/TeamPlayers
    /// (see PlayerDocumentEntityConfiguration / UserTeamEntityConfiguration), so any test
    /// inserting a PlayerDocument or a UserTeam.LinkedTeamPlayerId needs a real graph, not a
    /// bare Id string. Mirrors UpdateTeamPlayerSelfEditTests.CreateTeamPlayerAsync.
    /// </summary>
    public record TestTeamPlayer(string TeamPlayerId, string TeamId);

    public static class PlayerDocumentTestData
    {
        public static async Task<TestTeamPlayer> CreateTeamPlayerWithTeamAsync(AppDbContext db)
        {
            var teamPlayerId = await CreateTeamPlayerAsync(db);
            var teamId = db.TeamPlayers.Single(tp => tp.Id == teamPlayerId).TeamId;
            return new TestTeamPlayer(teamPlayerId, teamId);
        }

        public static async Task<string> CreateTeamPlayerAsync(AppDbContext db)
        {
            var club = Club.Create($"PlayerDocuments Test Club {Guid.NewGuid():N}", 1);
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
                Name = "PlayerDocuments Test Team",
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
                Alias = $"testplayer-{Guid.NewGuid():N}",
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

            return teamPlayer.Id;
        }
    }
}
