#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class PlayerModelObservationPersistenceTests
    {
        private readonly PostgresContainerFixture _fixture;

        public PlayerModelObservationPersistenceTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        internal static async Task<(string TeamId, string TeamPlayerId, string SubprincipioId)> SeedAsync(AppDbContext db)
        {
            var club = Club.Create($"Tracking Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase { Name = "Tracking Test Team", CategoryId = Category.U14.Id, ClubId = club.Id, SeasonId = season.Id });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase { Name = "Test", LastName = "Player", Alias = $"trk-{Guid.NewGuid():N}", ClubId = club.Id });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = team.Id,
                SeasonId = season.Id,
                JoinedDate = DateTime.UtcNow.AddDays(-100),
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);

            var model = new GameModel(team.Id, "Modelo de prueba", "2026-2027");
            var principle = new GamePrinciple(model.Id, gameMomentId: 1, key: $"p-{Guid.NewGuid():N}", numero: 2, "Ataque posicional", "Texto");
            var subprincipio = new Subprincipio(principle.Id, $"sp-{Guid.NewGuid():N}", "2.3", "Circular para desordenar", "Texto");
            principle.Subprincipios.Add(subprincipio);
            model.Principles.Add(principle);
            db.GameModels.Add(model);
            await db.SaveChangesAsync();

            return (team.Id, teamPlayer.Id, subprincipio.Id);
        }

        internal static async Task<string> SeedTeammateAsync(AppDbContext db, string teamPlayerId)
        {
            var existing = await db.TeamPlayers.AsNoTracking().SingleAsync(tp => tp.Id == teamPlayerId);
            var clubId = await db.Players.AsNoTracking().Where(p => p.Id == existing.PlayerId).Select(p => p.ClubId).SingleAsync();

            var player = Player.Create(new PlayerModelBase { Name = "Other", LastName = "Player", Alias = $"trk-{Guid.NewGuid():N}", ClubId = clubId });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teammate = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = existing.TeamId,
                SeasonId = existing.SeasonId,
                JoinedDate = DateTime.UtcNow.AddDays(-100),
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teammate);
            await db.SaveChangesAsync();
            return teammate.Id;
        }

        [Fact]
        public async Task DeletingTheSubprincipio_KeepsTheObservationWithItsLabels()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, subprincipioId) = await SeedAsync(db);
            var observation = PlayerModelObservation.ForGameModel(
                teamPlayerId, teamId, new DateOnly(2026, 10, 14),
                new SubprincipioSnapshot(subprincipioId, "Ataque organizado", "2. Ataque posicional", "2.3 Circular para desordenar"),
                ObservationAssessment.NotAchieved, "Busca el pase vertical", "coach-1");
            db.PlayerModelObservations.Add(observation);
            await db.SaveChangesAsync();

            db.Subprincipios.Remove(await db.Subprincipios.SingleAsync(s => s.Id == subprincipioId));
            await db.SaveChangesAsync();

            await using var readDb = _fixture.CreateDbContext();
            var stored = await readDb.PlayerModelObservations.AsNoTracking().SingleAsync(o => o.Id == observation.Id);
            Assert.Null(stored.SubprincipioId);
            Assert.Equal("Ataque organizado", stored.MomentName);
            Assert.Equal("2. Ataque posicional", stored.PrincipleLabel);
            Assert.Equal("2.3 Circular para desordenar", stored.SubprincipioLabel);
            Assert.Equal(ObservationAssessment.NotAchieved, stored.Assessment);
            Assert.Empty(stored.Habilidades);
        }
    }
}
