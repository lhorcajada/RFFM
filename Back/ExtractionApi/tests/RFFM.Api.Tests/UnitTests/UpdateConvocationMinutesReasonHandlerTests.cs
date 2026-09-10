#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Assistances;
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
    public class UpdateConvocationMinutesReasonHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UpdateConvocationMinutesReasonHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        // Same seeding pattern as UpdateConvocationStatusHandlerTests.SeedConvocationAsync.
        private async Task<(string EventId, string TeamPlayerId, string ConvocationId)> SeedConvocationAsync(AppDbContext db)
        {
            var club = Club.Create($"MinutesReason Test Club {Guid.NewGuid():N}", 1);
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
                Name = "MinutesReason Test Team",
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

            var sportEvent = SportEvent.CreateNew(
                "MinutesReason Test Event",
                DateTime.UtcNow.AddDays(1),
                DateTime.UtcNow.AddDays(1),
                null, null, null, null,
                eventTypeId: 1, team.Id, null);
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

            return (sportEvent.Id, teamPlayer.Id, convocation.Id);
        }

        [Fact]
        public async Task Handle_SetsReason()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, _, convocationId) = await SeedConvocationAsync(db);

            var handler = new UpdateConvocationMinutesReason.Handler(db);
            var request = new UpdateConvocationMinutesReason.UpdateConvocationMinutesReasonRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                Reason = "Portero suplente vino de vacaciones"
            };

            await handler.Handle(request, CancellationToken.None);

            var updated = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == convocationId);
            Assert.Equal("Portero suplente vino de vacaciones", updated.MinutesReason);
        }

        [Fact]
        public async Task Handle_WithNullReason_ClearsPreviouslySetReason()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, _, convocationId) = await SeedConvocationAsync(db);

            var handler = new UpdateConvocationMinutesReason.Handler(db);
            await handler.Handle(new UpdateConvocationMinutesReason.UpdateConvocationMinutesReasonRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                Reason = "Motivo inicial"
            }, CancellationToken.None);

            await handler.Handle(new UpdateConvocationMinutesReason.UpdateConvocationMinutesReasonRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                Reason = null
            }, CancellationToken.None);

            var updated = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == convocationId);
            Assert.Null(updated.MinutesReason);
        }

        [Fact]
        public async Task Handle_UnknownConvocation_Throws()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, _, _) = await SeedConvocationAsync(db);

            var handler = new UpdateConvocationMinutesReason.Handler(db);
            var request = new UpdateConvocationMinutesReason.UpdateConvocationMinutesReasonRequest
            {
                EventId = eventId,
                ConvocationId = "unknown-convocation-id",
                Reason = "test"
            };

            await Assert.ThrowsAsync<ArgumentException>(
                async () => await handler.Handle(request, CancellationToken.None));
        }

        [Fact]
        public void Validator_RejectsReasonLongerThan500Characters()
        {
            var validator = new UpdateConvocationMinutesReason.Validator();
            var request = new UpdateConvocationMinutesReason.UpdateConvocationMinutesReasonRequest
            {
                EventId = "e1",
                ConvocationId = "c1",
                Reason = new string('a', 501)
            };

            var result = validator.Validate(request);

            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validator_AllowsNullReason()
        {
            var validator = new UpdateConvocationMinutesReason.Validator();
            var request = new UpdateConvocationMinutesReason.UpdateConvocationMinutesReasonRequest
            {
                EventId = "e1",
                ConvocationId = "c1",
                Reason = null
            };

            var result = validator.Validate(request);

            Assert.True(result.IsValid);
        }
    }
}
