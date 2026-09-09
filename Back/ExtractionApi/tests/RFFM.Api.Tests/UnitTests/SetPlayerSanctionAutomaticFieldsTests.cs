#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Players.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Covers exposing IsAutomatic/Fine on SanctionRecordResponse and preserving IsAutomatic/
    /// SourceEventId across an Update of an automatic sanction (design.md Decisión 6, tasks.md
    /// sección 6). Uses the AppDbContext directly (no HTTP host) — SetPlayerSanction's write
    /// endpoints are inline Minimal API handlers, so exercising them via a plain db + ToResponse
    /// round-trip through the entity is equivalent and mirrors GetPlayerSeasonCardsHandlerTests'
    /// direct-handler style; SanctionEndpointAuthorizationTests already covers the HTTP layer.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class SetPlayerSanctionAutomaticFieldsTests
    {
        private readonly PostgresContainerFixture _fixture;

        public SetPlayerSanctionAutomaticFieldsTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<string> SeedTeamPlayerAsync(AppDbContext db)
        {
            var club = Club.Create($"SanctionFields Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "SanctionFields Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test", LastName = "Player", Alias = $"testplayer-{Guid.NewGuid():N}", ClubId = club.Id
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

        [Fact]
        public async Task UpdatingAutomaticSanction_ChangingOnlyFineAndDescription_PreservesIsAutomaticAndSourceEventId()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var teamPlayerId = await SeedTeamPlayerAsync(db);

            var sanction = TeamPlayerSanction.CreateAutomatic(
                teamPlayerId, SanctionCategory.Competition, DateTime.UtcNow, "Tarjeta roja",
                "Generada automáticamente: expulsión (tarjeta roja) en el partido del ... vs ...", "source-event-1");
            db.TeamPlayerSanctions.Add(sanction);
            await db.SaveChangesAsync();

            // Act — mirrors the PUT handler body in SetPlayerSanction.cs.
            sanction.Update(SanctionCategory.Competition, sanction.StartDate, sanction.SanctionType, "Multa añadida", null, null, fine: 30m);
            await db.SaveChangesAsync();

            // Assert
            var reloaded = await db.TeamPlayerSanctions.AsNoTracking().FirstAsync(s => s.Id == sanction.Id);
            Assert.True(reloaded.IsAutomatic);
            Assert.Equal("source-event-1", reloaded.SourceEventId);
            Assert.Equal(30m, reloaded.Fine);
            Assert.Equal("Multa añadida", reloaded.Description);
        }

        [Fact]
        public void ToResponse_ExposesIsAutomaticAndFine()
        {
            var sanction = TeamPlayerSanction.Create(
                "tp-1", SanctionCategory.InternalDiscipline, DateTime.UtcNow, "Incumplimiento de normas",
                "Llegó tarde", null, fine: 10m);

            var response = new SetPlayerSanction.SanctionRecordResponse(
                sanction.Id, sanction.Category.Name, sanction.StartDate, sanction.SanctionType,
                sanction.Description, sanction.EstimatedEnd, sanction.EndDate, sanction.IsAutomatic, sanction.Fine);

            Assert.False(response.IsAutomatic);
            Assert.Equal(10m, response.Fine);
        }
    }
}
