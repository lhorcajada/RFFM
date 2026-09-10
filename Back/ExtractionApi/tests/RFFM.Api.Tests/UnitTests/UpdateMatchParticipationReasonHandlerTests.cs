#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Convocations;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class UpdateMatchParticipationReasonHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UpdateMatchParticipationReasonHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        // Same seeding pattern as GetMatchParticipationHandlerTests.SeedTeamAndPlayerAsync.
        private async Task<(string TeamId, string TeamPlayerId)> SeedTeamAndPlayerAsync(AppDbContext db)
        {
            var club = Club.Create($"MatchParticipationReason Test Club {Guid.NewGuid():N}", 1);
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
                Name = "MatchParticipationReason Test Team",
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

            return (team.Id, teamPlayer.Id);
        }

        private static async Task SaveParticipationAsync(AppDbContext db, string eventId, string teamId, string teamPlayerId, int minutesPlayed)
        {
            var saveHandler = new SaveMatchParticipation.Handler(db);
            var saveRequest = new SaveMatchParticipation.SaveMatchParticipationRequest
            {
                EventId = eventId,
                TeamId = teamId,
                ScoreLocal = 1,
                ScoreVisitor = 0,
                MatchPhase = "finished",
                Players = new List<SaveMatchParticipation.PlayerParticipationDto>
                {
                    new(teamPlayerId, minutesPlayed, true, 0, null)
                }
            };
            await saveHandler.Handle(saveRequest, CancellationToken.None);
        }

        [Fact]
        public async Task Handle_SetsReason_OnExistingParticipation()
        {
            await using var db = _fixture.CreateDbContext();
            var eventId = Guid.NewGuid().ToString();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            await SaveParticipationAsync(db, eventId, teamId, teamPlayerId, 30);

            var handler = new UpdateMatchParticipationReason.Handler(db);
            var request = new UpdateMatchParticipationReason.UpdateMatchParticipationReasonRequest
            {
                EventId = eventId,
                TeamPlayerId = teamPlayerId,
                Reason = "Portero titular vino de vacaciones, minutos reducidos"
            };

            await handler.Handle(request, CancellationToken.None);

            var updated = await db.MatchParticipations.AsNoTracking()
                .FirstAsync(mp => mp.EventId == eventId && mp.TeamPlayerId == teamPlayerId);
            Assert.Equal("Portero titular vino de vacaciones, minutos reducidos", updated.MinutesReason);
        }

        [Fact]
        public async Task Handle_WithNullReason_ClearsPreviouslySetReason()
        {
            await using var db = _fixture.CreateDbContext();
            var eventId = Guid.NewGuid().ToString();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            await SaveParticipationAsync(db, eventId, teamId, teamPlayerId, 30);

            var handler = new UpdateMatchParticipationReason.Handler(db);
            await handler.Handle(new UpdateMatchParticipationReason.UpdateMatchParticipationReasonRequest
            {
                EventId = eventId,
                TeamPlayerId = teamPlayerId,
                Reason = "Motivo inicial"
            }, CancellationToken.None);

            await handler.Handle(new UpdateMatchParticipationReason.UpdateMatchParticipationReasonRequest
            {
                EventId = eventId,
                TeamPlayerId = teamPlayerId,
                Reason = null
            }, CancellationToken.None);

            var updated = await db.MatchParticipations.AsNoTracking()
                .FirstAsync(mp => mp.EventId == eventId && mp.TeamPlayerId == teamPlayerId);
            Assert.Null(updated.MinutesReason);
        }

        [Fact]
        public async Task Handle_NoExistingParticipation_ThrowsNotFoundException()
        {
            await using var db = _fixture.CreateDbContext();
            var eventId = Guid.NewGuid().ToString();
            var (_, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            // No SaveMatchParticipation call — no row exists for this (eventId, teamPlayerId).

            var handler = new UpdateMatchParticipationReason.Handler(db);
            var request = new UpdateMatchParticipationReason.UpdateMatchParticipationReasonRequest
            {
                EventId = eventId,
                TeamPlayerId = teamPlayerId,
                Reason = "test"
            };

            var ex = await Assert.ThrowsAsync<NotFoundException>(
                async () => await handler.Handle(request, CancellationToken.None));
            Assert.Equal("MatchParticipationNotFound", ex.Code);
        }

        [Fact]
        public async Task SaveMatchParticipation_ReSaving_DoesNotClearPreviouslySetReason()
        {
            await using var db = _fixture.CreateDbContext();
            var eventId = Guid.NewGuid().ToString();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            await SaveParticipationAsync(db, eventId, teamId, teamPlayerId, 30);

            var reasonHandler = new UpdateMatchParticipationReason.Handler(db);
            await reasonHandler.Handle(new UpdateMatchParticipationReason.UpdateMatchParticipationReasonRequest
            {
                EventId = eventId,
                TeamPlayerId = teamPlayerId,
                Reason = "Rotación planificada de porteros"
            }, CancellationToken.None);

            // Re-save the live match state (e.g. minutes updated as the match progresses).
            await SaveParticipationAsync(db, eventId, teamId, teamPlayerId, 45);

            var updated = await db.MatchParticipations.AsNoTracking()
                .FirstAsync(mp => mp.EventId == eventId && mp.TeamPlayerId == teamPlayerId);
            Assert.Equal(45, updated.MinutesPlayed);
            Assert.Equal("Rotación planificada de porteros", updated.MinutesReason);
        }

        [Fact]
        public void Validator_RejectsReasonLongerThan500Characters()
        {
            var validator = new UpdateMatchParticipationReason.Validator();
            var request = new UpdateMatchParticipationReason.UpdateMatchParticipationReasonRequest
            {
                EventId = "e1",
                TeamPlayerId = "tp1",
                Reason = new string('a', 501)
            };

            var result = validator.Validate(request);

            Assert.False(result.IsValid);
        }
    }
}
