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
    /// <summary>
    /// Covers MinutesReason exposure on GetEventConvocations' ConvocationResponse
    /// (design.md, add-match-minutes-reason-note).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class GetEventConvocationsHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetEventConvocationsHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string EventId, string TeamPlayerId, string ConvocationId)> SeedConvocationAsync(
            AppDbContext db, string? minutesReason = null)
        {
            var club = Club.Create($"GetEventConvocations Test Club {Guid.NewGuid():N}", 1);
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
                Name = "GetEventConvocations Test Team",
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
                "GetEventConvocations Test Event",
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
            if (minutesReason != null)
                convocation.SetMinutesReason(minutesReason);
            db.Convocations.Add(convocation);
            await db.SaveChangesAsync();

            return (sportEvent.Id, teamPlayer.Id, convocation.Id);
        }

        [Fact]
        public async Task Handle_ConvocationWithMinutesReason_ReturnsReasonInResponse()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamId, _) = await SeedConvocationAsync(db, minutesReason: "Portero suplente esta semana");

            var handler = new GetEventConvocations.Handler(db);
            var result = await handler.Handle(
                new GetEventConvocations.EventConvocationsQuery { EventId = eventId, TeamId = teamId },
                CancellationToken.None);

            var row = Assert.Single(result);
            Assert.Equal("Portero suplente esta semana", row.MinutesReason);
        }

        [Fact]
        public async Task Handle_ConvocationWithoutMinutesReason_ReturnsNull()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamId, _) = await SeedConvocationAsync(db);

            var handler = new GetEventConvocations.Handler(db);
            var result = await handler.Handle(
                new GetEventConvocations.EventConvocationsQuery { EventId = eventId, TeamId = teamId },
                CancellationToken.None);

            var row = Assert.Single(result);
            Assert.Null(row.MinutesReason);
        }

        [Fact]
        public async Task Handle_SetViaUpdateConvocationMinutesReasonEndpoint_RoundTripsThroughListing()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamId, convocationId) = await SeedConvocationAsync(db);

            var updateHandler = new UpdateConvocationMinutesReason.Handler(db);
            await updateHandler.Handle(new UpdateConvocationMinutesReason.UpdateConvocationMinutesReasonRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                Reason = "Decisión técnica: rotación"
            }, CancellationToken.None);

            var listHandler = new GetEventConvocations.Handler(db);
            var result = await listHandler.Handle(
                new GetEventConvocations.EventConvocationsQuery { EventId = eventId, TeamId = teamId },
                CancellationToken.None);

            var row = Assert.Single(result);
            Assert.Equal("Decisión técnica: rotación", row.MinutesReason);
        }
    }
}
