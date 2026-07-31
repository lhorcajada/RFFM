#nullable enable
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.SportEvents.Commands;
using RFFM.Api.Features.Mobile.PushNotifications;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class DeleteSportEventHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public DeleteSportEventHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static Mock<IPushNotificationDispatcher> MockDispatcher()
        {
            var mock = new Mock<IPushNotificationDispatcher>();
            mock.Setup(d => d.DispatchCalendarChangedAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            return mock;
        }

        private async Task<SportEvent> SeedSportEventAsync(AppDbContext db)
        {
            var club = Club.Create($"Delete Push Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Delete Push Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var ev = SportEvent.CreateNew("Entrenamiento", DateTime.UtcNow.AddDays(1), DateTime.UtcNow.AddDays(1), null, null, null, null, 2, team.Id, null);
            db.SportEvents.Add(ev);
            await db.SaveChangesAsync();

            return ev;
        }

        [Fact]
        public async Task Handle_DeletesEvent_AndDispatchesCalendarChanged()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var ev = await SeedSportEventAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var dispatcherMock = MockDispatcher();
            var handler = new DeleteSportEventHandler(db, dispatcherMock.Object);

            await handler.Handle(new DeleteSportEventCommand { SportEventId = ev.Id }, CancellationToken.None);

            var stillExists = await db.SportEvents.AsNoTracking().AnyAsync(e => e.Id == ev.Id);
            Assert.False(stillExists);

            dispatcherMock.Verify(d => d.DispatchCalendarChangedAsync(ev.Id, ev.TeamId, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Handle_NonExistentEvent_ThrowsKeyNotFoundException_AndDoesNotDispatch()
        {
            await using var db = _fixture.CreateDbContext();
            var dispatcherMock = MockDispatcher();
            var handler = new DeleteSportEventHandler(db, dispatcherMock.Object);

            await Assert.ThrowsAsync<KeyNotFoundException>(() =>
                handler.Handle(new DeleteSportEventCommand { SportEventId = "nonexistent" }, CancellationToken.None).AsTask());

            dispatcherMock.Verify(d => d.DispatchCalendarChangedAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }
    }
}
