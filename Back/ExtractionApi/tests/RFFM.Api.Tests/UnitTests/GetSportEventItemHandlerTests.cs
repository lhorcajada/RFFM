#nullable enable
using System;
using System.Threading;
using System.Threading.Tasks;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetSportEventItemHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetSportEventItemHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<string> SeedSportEventAsync(AppDbContext db, int? selectedKitNumber)
        {
            var club = Club.Create($"GetSportEventItem Test Club {Guid.NewGuid():N}", 1);
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
                Name = "GetSportEventItem Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var sportEvent = SportEvent.CreateNew(
                "Amistoso",
                DateTime.UtcNow.AddDays(1),
                DateTime.UtcNow.AddDays(1),
                null, null, null, null,
                2, team.Id, null);
            sportEvent.SetSelectedKit(selectedKitNumber);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();

            return sportEvent.Id;
        }

        [Fact]
        public async Task Handle_WithSelectedKit_ReturnsSelectedKitNumber()
        {
            await using var db = _fixture.CreateDbContext();
            var eventId = await SeedSportEventAsync(db, selectedKitNumber: 2);

            var handler = new GetSportEventItem.GetSportEventItemRequestHandler(db);
            var result = await handler.Handle(new GetSportEventItem.SportEventItemQuery { Id = eventId }, CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal(2, result!.SelectedKitNumber);
        }

        [Fact]
        public async Task Handle_WithoutSelectedKit_ReturnsNull()
        {
            await using var db = _fixture.CreateDbContext();
            var eventId = await SeedSportEventAsync(db, selectedKitNumber: null);

            var handler = new GetSportEventItem.GetSportEventItemRequestHandler(db);
            var result = await handler.Handle(new GetSportEventItem.SportEventItemQuery { Id = eventId }, CancellationToken.None);

            Assert.NotNull(result);
            Assert.Null(result!.SelectedKitNumber);
        }
    }
}
