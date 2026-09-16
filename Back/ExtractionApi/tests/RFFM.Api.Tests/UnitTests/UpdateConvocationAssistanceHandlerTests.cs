#nullable enable
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
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
    public class UpdateConvocationAssistanceHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UpdateConvocationAssistanceHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string EventId, string ConvocationId)> SeedConvocationAsync(AppDbContext db)
        {
            var club = Club.Create($"Assistance Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Assistance Test Team",
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
                FamilyMembers = new System.Collections.Generic.List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            var sportEvent = SportEvent.CreateNew(
                "Assistance Test Event",
                DateTime.UtcNow.AddDays(1),
                DateTime.UtcNow.AddDays(1),
                null, null, null, null,
                2, // training event
                team.Id,
                null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();

            var convocation = Convocation.Create(new ConvocationModel
            {
                EventId = sportEvent.Id,
                TeamPlayerId = teamPlayer.Id,
                AssistanceTypeId = null,
                ResponseDateTime = DateTime.UtcNow,
                ConvocationStatusId = 1,
                ExcuseTypeId = null
            });
            db.Convocations.Add(convocation);
            await db.SaveChangesAsync();

            return (sportEvent.Id, convocation.Id);
        }

        [Fact]
        public async Task Handle_WithLateArrivalAndExcuseTypeId_PersistsExcuse()
        {
            // RED — test should fail with current code that clears ExcuseTypeId for LateArrival
            await using var db = _fixture.CreateDbContext();
            var (eventId, convocationId) = await SeedConvocationAsync(db);

            var handler = new UpdateConvocationAssistance.Handler(db);
            var request = new UpdateConvocationAssistance.UpdateAssistanceRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                AssistanceTypeId = AssistanceType.LateArrival.Id,  // 4
                ExcuseTypeId = 1  // Some valid excuse type id
            };

            await handler.Handle(request, CancellationToken.None);

            var updated = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == convocationId);
            Assert.Equal(AssistanceType.LateArrival.Id, updated.AssistanceTypeId);
            Assert.Equal(1, updated.ExcuseTypeId);  // Should persist the excuse type
        }

        [Fact]
        public async Task Handle_WithLateArrivalAndNoExcuseTypeId_LeavesExcuseNull()
        {
            // Regression guard — LateArrival without ExcuseTypeId should leave it null
            await using var db = _fixture.CreateDbContext();
            var (eventId, convocationId) = await SeedConvocationAsync(db);

            var handler = new UpdateConvocationAssistance.Handler(db);
            var request = new UpdateConvocationAssistance.UpdateAssistanceRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                AssistanceTypeId = AssistanceType.LateArrival.Id,  // 4
                ExcuseTypeId = null  // No excuse type
            };

            await handler.Handle(request, CancellationToken.None);

            var updated = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == convocationId);
            Assert.Equal(AssistanceType.LateArrival.Id, updated.AssistanceTypeId);
            Assert.Null(updated.ExcuseTypeId);  // Should remain null
        }

        [Fact]
        public async Task Handle_WithExcusedAbsenceAndExcuseTypeId_StillPersistsExcuse()
        {
            // Regression guard — existing behavior for ExcusedAbsence should still work
            await using var db = _fixture.CreateDbContext();
            var (eventId, convocationId) = await SeedConvocationAsync(db);

            var handler = new UpdateConvocationAssistance.Handler(db);
            var request = new UpdateConvocationAssistance.UpdateAssistanceRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                AssistanceTypeId = AssistanceType.ExcusedAbsence.Id,  // 2
                ExcuseTypeId = 2  // Some valid excuse type id
            };

            await handler.Handle(request, CancellationToken.None);

            var updated = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == convocationId);
            Assert.Equal(AssistanceType.ExcusedAbsence.Id, updated.AssistanceTypeId);
            Assert.Equal(2, updated.ExcuseTypeId);  // Should persist the excuse type
        }
    }
}
