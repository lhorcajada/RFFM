#nullable enable
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendar.Responses;
using RFFM.Api.Features.Federation.Competitions.Services;
using RFFM.Api.Features.Mobile.Competitions.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using System;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetTeamNextMatchHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetTeamNextMatchHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<string> SeedTeamAsync(AppDbContext db, int? rffmCompetitionId, int? rffmGroupId)
        {
            var club = Club.Create($"NextMatch Test Club {Guid.NewGuid():N}", 1);
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
                Name = "NextMatch Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id,
                RffmCompetitionId = rffmCompetitionId,
                RffmGroupId = rffmGroupId
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return team.Id;
        }

        private static MatchResponse Match(DateTime date, string localGoals, string visitorGoals, string localName = "Home", string visitorName = "Away")
            => new()
            {
                Date = date,
                Time = "10:00",
                LocalTeamName = localName,
                VisitorTeamName = visitorName,
                LocalGoals = localGoals,
                VisitorGoals = visitorGoals
            };

        [Fact]
        public async Task Handle_MultipleFutureUnplayedMatches_ReturnsTheEarliestOne()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db, rffmCompetitionId: 25255269, rffmGroupId: 25255283);

            var today = DateTime.UtcNow.Date;
            var calendarServiceMock = new Mock<ICalendarService>();
            calendarServiceMock
                .Setup(s => s.GetCalendarAsync(25255269, 25255283, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new CalendarResponse
                {
                    MatchDays =
                    [
                        new CalendarMatchDayResponse
                        {
                            Date = today.AddDays(-7),
                            MatchDayNumber = 1,
                            Matches = [Match(today.AddDays(-7), "1", "0")] // played, in the past
                        },
                        new CalendarMatchDayResponse
                        {
                            Date = today.AddDays(10),
                            MatchDayNumber = 3,
                            Matches = [Match(today.AddDays(10), "", "", localName: "Later Team")] // unplayed, further out
                        },
                        new CalendarMatchDayResponse
                        {
                            Date = today.AddDays(2),
                            MatchDayNumber = 2,
                            Matches = [Match(today.AddDays(2), "", "", localName: "Soonest Team")] // unplayed, soonest
                        }
                    ]
                });

            var handler = new GetTeamNextMatch.Handler(db, calendarServiceMock.Object);
            var query = new GetTeamNextMatch.MobileNextMatchQuery { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.NotNull(result.Match);
            Assert.Equal("Soonest Team", result.Match!.LocalTeamName);
        }

        [Fact]
        public async Task Handle_MatchScheduledToday_IsConsideredAValidCandidate()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db, rffmCompetitionId: 25255269, rffmGroupId: 25255283);

            var today = DateTime.UtcNow.Date;
            var calendarServiceMock = new Mock<ICalendarService>();
            calendarServiceMock
                .Setup(s => s.GetCalendarAsync(25255269, 25255283, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new CalendarResponse
                {
                    MatchDays =
                    [
                        new CalendarMatchDayResponse
                        {
                            Date = today,
                            MatchDayNumber = 1,
                            Matches = [Match(today, "", "", localName: "Today Team")]
                        }
                    ]
                });

            var handler = new GetTeamNextMatch.Handler(db, calendarServiceMock.Object);
            var query = new GetTeamNextMatch.MobileNextMatchQuery { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.NotNull(result.Match);
            Assert.Equal("Today Team", result.Match!.LocalTeamName);
        }

        [Fact]
        public async Task Handle_NoFutureUnplayedMatch_ReturnsNullMatch()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db, rffmCompetitionId: 25255269, rffmGroupId: 25255283);

            var today = DateTime.UtcNow.Date;
            var calendarServiceMock = new Mock<ICalendarService>();
            calendarServiceMock
                .Setup(s => s.GetCalendarAsync(25255269, 25255283, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new CalendarResponse
                {
                    MatchDays =
                    [
                        new CalendarMatchDayResponse
                        {
                            Date = today.AddDays(-3),
                            MatchDayNumber = 1,
                            Matches = [Match(today.AddDays(-3), "2", "2")] // played, in the past
                        },
                        new CalendarMatchDayResponse
                        {
                            Date = today.AddDays(5),
                            MatchDayNumber = 2,
                            Matches = [Match(today.AddDays(5), "3", "1")] // scheduled in the future but already has a result
                        }
                    ]
                });

            var handler = new GetTeamNextMatch.Handler(db, calendarServiceMock.Object);
            var query = new GetTeamNextMatch.MobileNextMatchQuery { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.Null(result.Match);
        }

        [Fact]
        public async Task Handle_TeamNotAssociatedWithCompetition_ReturnsNullWithoutCallingService()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db, rffmCompetitionId: null, rffmGroupId: null);

            var calendarServiceMock = new Mock<ICalendarService>();
            var handler = new GetTeamNextMatch.Handler(db, calendarServiceMock.Object);
            var query = new GetTeamNextMatch.MobileNextMatchQuery { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.Null(result.Match);
            calendarServiceMock.Verify(
                s => s.GetCalendarAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()),
                Times.Never);
        }

        [Fact]
        public async Task Handle_TeamDoesNotExist_ThrowsDomainException()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var calendarServiceMock = new Mock<ICalendarService>();
            var handler = new GetTeamNextMatch.Handler(db, calendarServiceMock.Object);
            var query = new GetTeamNextMatch.MobileNextMatchQuery { TeamId = "non-existent-team-id" };

            // Act & Assert
            await Assert.ThrowsAsync<DomainException>(() => handler.Handle(query, CancellationToken.None).AsTask());
        }
    }
}
