#nullable enable
using System;
using System.Linq;
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
    public class UpdateConvocationsAssistanceBulkHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UpdateConvocationsAssistanceBulkHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string EventId, string[] ConvocationIds)> SeedConvocationsAsync(AppDbContext db, int count)
        {
            var club = Club.Create($"Bulk Assistance Club {Guid.NewGuid():N}", 1);
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
                Name = "Bulk Assistance Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var sportEvent = SportEvent.CreateNew(
                "Bulk Assistance Event",
                DateTime.UtcNow.AddDays(1),
                DateTime.UtcNow.AddDays(1),
                null, null, null, null,
                2,
                team.Id,
                null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();

            var ids = new string[count];
            for (var i = 0; i < count; i++)
            {
                var player = Player.Create(new PlayerModelBase
                {
                    Name = "Test",
                    LastName = $"Player{i}",
                    Alias = $"bulkplayer-{Guid.NewGuid():N}",
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
                ids[i] = convocation.Id;
            }

            return (sportEvent.Id, ids);
        }

        [Fact]
        public async Task Handle_WithSeveralConvocations_SetsAssistanceOnAllOfThem()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, ids) = await SeedConvocationsAsync(db, 3);

            var handler = new UpdateConvocationsAssistanceBulk.Handler(db);
            await handler.Handle(new UpdateConvocationsAssistanceBulk.BulkAssistanceRequest
            {
                EventId = eventId,
                ConvocationIds = ids.ToList(),
                AssistanceTypeId = AssistanceType.Attendance.Id
            }, CancellationToken.None);

            var stored = await db.Convocations.AsNoTracking().Where(c => ids.Contains(c.Id)).ToListAsync();
            Assert.Equal(3, stored.Count);
            Assert.All(stored, c => Assert.Equal(AssistanceType.Attendance.Id, c.AssistanceTypeId));
        }

        [Fact]
        public async Task Handle_WithConvocationFromAnotherEvent_ChangesNothing()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, ids) = await SeedConvocationsAsync(db, 2);
            var (_, otherIds) = await SeedConvocationsAsync(db, 1);

            var handler = new UpdateConvocationsAssistanceBulk.Handler(db);
            var request = new UpdateConvocationsAssistanceBulk.BulkAssistanceRequest
            {
                EventId = eventId,
                ConvocationIds = ids.Concat(otherIds).ToList(),
                AssistanceTypeId = AssistanceType.Attendance.Id
            };

            await Assert.ThrowsAsync<ArgumentException>(async () => await handler.Handle(request, CancellationToken.None).AsTask());

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.Convocations.AsNoTracking().Where(c => ids.Contains(c.Id)).ToListAsync();
            Assert.All(stored, c => Assert.Null(c.AssistanceTypeId));
        }

        [Fact]
        public async Task Handle_WithInvalidAssistanceType_Throws()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, ids) = await SeedConvocationsAsync(db, 1);

            var handler = new UpdateConvocationsAssistanceBulk.Handler(db);
            var request = new UpdateConvocationsAssistanceBulk.BulkAssistanceRequest
            {
                EventId = eventId,
                ConvocationIds = ids.ToList(),
                AssistanceTypeId = 999
            };

            await Assert.ThrowsAnyAsync<Exception>(async () => await handler.Handle(request, CancellationToken.None).AsTask());
        }
    }
}
